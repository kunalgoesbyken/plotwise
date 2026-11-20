import type { BuildingType } from '@/plot/plot'
import type { Cite, RulePack } from '@/rules'
import { isMember, type Interpretations } from './interpretations'

export type ClassMembership = { readonly member: boolean; readonly cites: readonly Cite[] }
export type Classes = { readonly residential: ClassMembership; readonly publicBuilding: ClassMembership }

const NOT_MEMBER: ClassMembership = { member: false, cites: [] }

export function classesFor(pack: RulePack, readings: Interpretations, buildingType: BuildingType): Classes {
  if (!pack.classification) return { residential: NOT_MEMBER, publicBuilding: NOT_MEMBER }
  const { residential, publicBuilding } = pack.classification[buildingType]
  return { residential: isMember(pack, residential, readings), publicBuilding: isMember(pack, publicBuilding, readings) }
}
