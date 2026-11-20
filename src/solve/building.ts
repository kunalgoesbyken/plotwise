import type { RulePack } from '@/rules'
import { satisfies } from './bound'

export type Building = { readonly heightM: number; readonly storeys: number; readonly floorAreaSqm: number }

type Classed = Pick<RulePack, 'buildingClasses'>

export function isHighRiseOrExtraLarge({ buildingClasses }: Classed, { heightM, floorAreaSqm }: Building): boolean {
  if (!buildingClasses) return false
  return satisfies(heightM, buildingClasses.highRiseFromHeightM) || satisfies(floorAreaSqm, buildingClasses.extraLargeFromFloorAreaSqm)
}

export function isLarge({ buildingClasses }: Classed, { heightM, floorAreaSqm }: Building): boolean {
  if (!buildingClasses) return false
  if (satisfies(floorAreaSqm, buildingClasses.largeAboveFloorAreaSqm)) return true
  return satisfies(heightM, buildingClasses.largeIfTallFromHeightM) && satisfies(floorAreaSqm, buildingClasses.largeIfTallAboveFloorAreaSqm)
}
