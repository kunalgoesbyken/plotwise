import { BUILDING_TYPES } from '@/plot/plot'
import type { Bound, RulePack } from '@/rules'

function roadWidthBounds(pack: RulePack): Bound[] {
  const setbackBands = pack.roadSetbacks.flatMap(({ bands }) => bands.flatMap(({ roadWidthM }) => roadWidthM.min ?? []))
  const highRiseAccess = pack.highRise?.access.map((band) => band.roadWidthM) ?? []
  const useConditions = BUILDING_TYPES.flatMap((type) => {
    const condition = pack.useConditions?.[type]
    return condition?.kind === 'restrictedAbove' ? [condition.unlessRoadWidthM] : []
  })
  const accessTiers = pack.useConditions?.roadAccessTiers.map((tier) => tier.roadWidthM) ?? []
  return [...setbackBands, ...highRiseAccess, ...useConditions, ...accessTiers]
}

export function roadWidthThresholds(pack: RulePack): number[] {
  const widths = roadWidthBounds(pack)
    .filter((bound) => bound.cmp === 'gte')
    .map((bound) => bound.value)
  return [...new Set(widths)].sort((a, b) => a - b)
}
