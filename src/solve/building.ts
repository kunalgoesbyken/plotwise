import type { RulePack } from '@/rules'
import { satisfies } from './bound'

export type Building = { readonly heightM: number; readonly storeys: number; readonly floorAreaSqm: number }

export function isHighRiseOrExtraLarge(pack: RulePack, { heightM, floorAreaSqm }: Building): boolean {
  const { highRiseFromHeightM, extraLargeFromFloorAreaSqm } = pack.buildingClasses
  return satisfies(heightM, highRiseFromHeightM) || satisfies(floorAreaSqm, extraLargeFromFloorAreaSqm)
}

export function isLarge(pack: RulePack, { heightM, floorAreaSqm }: Building): boolean {
  const classes = pack.buildingClasses
  if (satisfies(floorAreaSqm, classes.largeAboveFloorAreaSqm)) return true
  return satisfies(heightM, classes.largeIfTallFromHeightM) && satisfies(floorAreaSqm, classes.largeIfTallAboveFloorAreaSqm)
}
