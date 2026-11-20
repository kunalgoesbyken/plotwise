import type { Limiter } from '@/designs'
import { stationDistance, type Limits } from '@/solve'
import { formatQuantity } from '@/text/format'
import { t } from '@/text/messages'
import { PACK } from './compute'

const metres = (value: number) => formatQuantity(value, 'm')

function buildingClassText({ highRise }: Limits): string {
  if (!highRise) throw new Error('a design limited by its building class needs the pack’s high-rise rules')
  return t('limited-by.building-class', { height: metres(highRise.fromHeightM.value) })
}

function sizeConditionText({ use }: Limits): string {
  const station = stationDistance(PACK)
  if (use.kind === 'permitted' || !station) return t('limited-by.use')
  return t('limited-by.use-unless', { road: metres(use.roadWidthM.value), station: metres(station.value) })
}

export function limiterText(limiter: Limiter, limits: Limits): string {
  switch (limiter) {
    case 'far':
      return t('limited-by.far')
    case 'building-class':
      return buildingClassText(limits)
    case 'use':
      return sizeConditionText(limits)
    case 'envelope':
      return t('limited-by.envelope')
  }
}
