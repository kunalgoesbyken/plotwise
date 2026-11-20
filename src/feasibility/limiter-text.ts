import type { Limiter } from '@/designs'
import type { RulePack } from '@/rules'
import { stationDistance, type Limits, type Solution } from '@/solve'
import { formatQuantity } from '@/text/format'
import { t } from '@/text/messages'

const metres = (value: number) => formatQuantity(value, 'm')

function buildingClassText({ highRise }: Limits): string {
  if (!highRise) throw new Error('a design limited by its building class needs the pack’s high-rise rules')
  return t('limited-by.building-class', { height: metres(highRise.fromHeightM.value) })
}

function heightText({ height }: Limits): string {
  if (height.planLimitM === null) throw new Error('a design limited by height needs a height limit')
  return t('limited-by.height', { height: metres(height.planLimitM) })
}

function sizeConditionText({ use }: Limits, pack: RulePack): string {
  const station = stationDistance(pack)
  if (use.kind === 'permitted' || !station) return t('limited-by.use')
  return t('limited-by.use-unless', { road: metres(use.roadWidthM.value), station: metres(station.value) })
}

export function limiterText(limiter: Limiter, { limits, pack }: Solution): string {
  switch (limiter) {
    case 'far':
      return t('limited-by.far')
    case 'building-class':
      return buildingClassText(limits)
    case 'use':
      return sizeConditionText(limits, pack)
    case 'height':
      return heightText(limits)
    case 'envelope':
      return t('limited-by.envelope')
  }
}
