import type { Limiter } from '@/designs'
import { stationDistance, type Limits } from '@/solve'
import { formatQuantity } from '@/text/format'
import { t } from '@/text/messages'
import { PACK } from './compute'

const metres = (value: number) => formatQuantity(value, 'm')

function sizeConditionText({ use }: Limits): string {
  if (use.kind === 'permitted') return t('limited-by.use')
  return t('limited-by.use-unless', { road: metres(use.roadWidthM.value), station: metres(stationDistance(PACK).value) })
}

export function limiterText(limiter: Limiter, limits: Limits): string {
  switch (limiter) {
    case 'far':
      return t('limited-by.far')
    case 'building-class':
      return t('limited-by.building-class', { height: metres(limits.highRise.fromHeightM.value) })
    case 'use':
      return sizeConditionText(limits)
    case 'envelope':
      return t('limited-by.envelope')
  }
}
