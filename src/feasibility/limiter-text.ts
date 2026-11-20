import type { Limiter } from '@/designs'
import { stationDistance, type Limits } from '@/solve'
import { formatQuantity } from '@/text/format'
import { t } from '@/text/messages'
import { PACK } from './compute'

const metres = (value: number) => formatQuantity(value, 'm')

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
      return t('limited-by.building-class', { height: metres(limits.highRise?.fromHeightM.value ?? 0) })
    case 'use':
      return sizeConditionText(limits)
    case 'envelope':
      return t('limited-by.envelope')
  }
}
