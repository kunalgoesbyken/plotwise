import type { Difference, Ranked, Standing } from '@/designs'
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

function dominatedText({ by, worse, better }: Extract<Standing, { kind: 'dominated' }>, unit: AreaUnit): string {
  const name = t('design.name', by.name)
  const [lessSqm] = worse.flatMap((difference) => (difference.measure === 'floor-area' ? [difference.amount] : []))
  const lead = lessSqm === undefined ? t('standing.same-area', { name }) : t('standing.less-area', { area: formatQuantity(lessSqm, unit), name })
  return t('standing.dominated', { lead, worse: listed(worse, 'worse', unit), better: listed(better, 'better', unit) })
}

function standingText(standing: Standing, unit: AreaUnit): string {
  switch (standing.kind) {
    case 'best':
      return t('standing.best')
    case 'same-as':
      return t('standing.same-as', { name: t('design.name', standing.of.name) })
    case 'dominated':
      return dominatedText(standing, unit)
    case 'alternative':
      return t('standing.alternative', { name: t('design.name', standing.over.name), better: listed(standing.better, 'better', unit) })
  }
}

export const standingLine = ({ design, standing }: Ranked, unit: AreaUnit) =>
  t('standing.line', { name: t('design.name', design.name), standing: standingText(standing, unit) })
