import { sameFloorArea, type Design, type Difference, type Ranked } from '@/designs'
import { ASSUMPTIONS } from '@/solve'
import { formatList, formatQuantity } from '@/text/format'
import { t } from '@/text/messages'
import type { AreaUnit } from '@/units/area'

type Side = 'worse' | 'better'

type Listed = Difference & { readonly measure: Exclude<Difference['measure'], 'floor-area'> }

const isListed = (difference: Difference): difference is Listed => difference.measure !== 'floor-area'

function differenceText(difference: Listed, side: Side, unit: AreaUnit): string {
  switch (difference.measure) {
    case 'high-rise':
      return t(`difference.${side}.high-rise`)
    case 'height':
      return t(`difference.${side}.height`, { height: formatQuantity(difference.amount, 'm') })
    case 'open-space':
      return t(`difference.${side}.open-space`, { area: formatQuantity(difference.amount, unit) })
    case 'failing-checks':
    case 'to-check':
      return t(`difference.${side}.${difference.measure}`, { count: difference.amount })
  }
}

const listed = (differences: readonly Difference[], side: Side, unit: AreaUnit) =>
  formatList(differences.filter(isListed).map((difference) => differenceText(difference, side, unit)))

const share = () => formatQuantity(ASSUMPTIONS.sameDesignShare.value, 'percent')

function leadText(design: Design, other: Design, worse: readonly Difference[], unit: AreaUnit): string {
  const name = t('design.name', other.name)
  const [lessSqm] = worse.flatMap((difference) => (difference.measure === 'floor-area' ? [difference.amount] : []))
  if (lessSqm !== undefined) return t('standing.less-area', { area: formatQuantity(lessSqm, unit), name })
  return sameFloorArea(design, other) ? t('standing.same-area', { name }) : t('standing.within-area', { name, share: share() })
}

const compared = (design: Design, other: Design, worse: readonly Difference[], better: readonly Difference[], unit: AreaUnit) => ({
  lead: leadText(design, other, worse, unit),
  worse: listed(worse, 'worse', unit),
  better: listed(better, 'better', unit),
})

function standingText({ design, standing }: Ranked, unit: AreaUnit): string {
  switch (standing.kind) {
    case 'best':
      return t('standing.best')
    case 'same-as':
      return t('standing.same-as', { name: t('design.name', standing.of.name), share: share() })
    case 'dominated':
      return t('standing.dominated', compared(design, standing.by, standing.worse, standing.better, unit))
    case 'alternative':
      return t('standing.alternative', compared(design, standing.over, standing.worse, standing.better, unit))
  }
}

export const standingLine = (option: Ranked, unit: AreaUnit) => t('standing.line', { name: t('design.name', option.design.name), standing: standingText(option, unit) })
