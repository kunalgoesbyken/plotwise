import type { BuildingType } from '@/plot/plot'
import type { Cite, ParkingDemand, ParkingRule } from '@/rules'
import { inRange, satisfies } from './bound'
import type { Sourced } from './limits'

export type ParkingNeed = {
  readonly use: BuildingType
  readonly floorAreaSqm: number
  readonly large: boolean
  readonly units: number
  readonly unitSqm: number
  readonly rooms: number
  readonly lobbySqm: number
  readonly officeSqm: number
}

type Demand = { readonly spaces: number; readonly cites: readonly Cite[] }

const NONE: Demand = { spaces: 0, cites: [] }

function roomTierSpaces(demand: Extract<ParkingDemand, { kind: 'perRoomTiers' }>, rooms: number): number {
  let [spaces, counted] = [demand.firstSpaces.value, demand.firstRooms.value]
  for (const tier of demand.tiers) {
    const upto = Math.min(rooms, tier.uptoRooms?.value ?? Infinity)
    spaces += Math.max(0, upto - counted) / tier.roomsPerSpace.value
    counted = Math.max(counted, upto)
  }
  return spaces
}

function demandByUse(demand: ParkingDemand, need: ParkingNeed): Demand {
  switch (demand.kind) {
    case 'perUnit':
      if (!satisfies(need.unitSqm, demand.unitsFromSqm)) return NONE
      return { spaces: need.units * demand.spacesPerUnit.value, cites: [demand.spacesPerUnit.cite, demand.unitsFromSqm.cite] }
    case 'perUnitBySize': {
      const band = demand.bands.find((b) => inRange(need.unitSqm, b.unitSqm))
      return band ? { spaces: need.units * band.spacesPerUnit.value, cites: [band.spacesPerUnit.cite] } : NONE
    }
    case 'perFloorArea':
      if (!satisfies(need.officeSqm, demand.appliesFromSqm)) return NONE
      return { spaces: need.officeSqm / demand.sqmPerSpace.value, cites: [demand.sqmPerSpace.cite, demand.appliesFromSqm.cite] }
    case 'perGrossArea':
      return { spaces: need.floorAreaSqm / demand.sqmPerSpace.value, cites: [demand.sqmPerSpace.cite] }
    case 'perRoomTiers':
      if (need.rooms === 0) return NONE
      return { spaces: roomTierSpaces(demand, need.rooms), cites: [demand.firstSpaces.cite, ...demand.tiers.map((t) => t.roomsPerSpace.cite)] }
    case 'perLobbyAndCommercialArea':
      if (!satisfies(need.lobbySqm, demand.appliesFromSqm)) return NONE
      return { spaces: need.lobbySqm / demand.lobbySqmPerSpace.value, cites: [demand.lobbySqmPerSpace.cite, demand.appliesFromSqm.cite] }
  }
}

function hallDemand({ hallSqmPerSpace }: ParkingRule, demand: ParkingDemand, need: ParkingNeed): Demand {
  if (!hallSqmPerSpace || demand.kind === 'perLobbyAndCommercialArea' || need.lobbySqm === 0) return NONE
  return { spaces: need.lobbySqm / hallSqmPerSpace.value, cites: [hallSqmPerSpace.cite] }
}

function ruleDemand(rule: ParkingRule, need: ParkingNeed): Demand {
  const demand = rule[need.use]
  const parts = [demandByUse(demand, need), hallDemand(rule, demand, need)]
  const byUse = {
    spaces: parts.reduce((sum, part) => sum + Math.ceil(part.spaces), 0),
    cites: [...parts.flatMap((part) => part.cites), ...(rule.fractionsRoundUp ? [rule.fractionsRoundUp] : [])],
  }
  const { largeBuildingSqmPerSpace, largerOfSumOrArea } = rule
  if (!need.large || !largeBuildingSqmPerSpace) return byUse
  const byArea = {
    spaces: Math.ceil(need.floorAreaSqm / largeBuildingSqmPerSpace.value),
    cites: [largeBuildingSqmPerSpace.cite, ...(largerOfSumOrArea ? [largerOfSumOrArea] : [])],
  }
  return byArea.spaces > byUse.spaces ? byArea : byUse
}

export function parkingSpaces(rules: readonly ParkingRule[], need: ParkingNeed): Sourced {
  const demand = rules.map((rule) => ruleDemand(rule, need)).reduce((most, d) => (d.spaces > most.spaces ? d : most), NONE)
  return { value: demand.spaces, cites: demand.cites }
}
