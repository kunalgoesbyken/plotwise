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
    case 'unitsPerSpaceBySize': {
      const band = demand.bands.find((b) => inRange(need.unitSqm, b.unitSqm))
      return band && need.units > 0 ? { spaces: need.units / band.unitsPerSpace.value, cites: [band.unitsPerSpace.cite] } : NONE
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

const roundingOf = ({ fractionsAboveHalfRoundUp }: ParkingRule) =>
  fractionsAboveHalfRoundUp ? (spaces: number) => Math.max(0, Math.ceil(spaces - 0.5)) : Math.ceil

function withVisitors({ visitors }: ParkingRule, stipulated: Demand, round: (spaces: number) => number): Demand {
  if (!visitors) return stipulated
  const spaces = Math.max(visitors.min.value, round(stipulated.spaces * visitors.share.value))
  return { spaces: stipulated.spaces + spaces, cites: [...stipulated.cites, visitors.share.cite, visitors.min.cite] }
}

function hallDemand({ hallSqmPerSpace }: ParkingRule, demand: ParkingDemand, need: ParkingNeed): Demand {
  if (!hallSqmPerSpace || demand.kind === 'perLobbyAndCommercialArea' || need.lobbySqm === 0) return NONE
  return { spaces: need.lobbySqm / hallSqmPerSpace.value, cites: [hallSqmPerSpace.cite] }
}

function ruleDemand(rule: ParkingRule, need: ParkingNeed): Demand {
  const demand = rule[need.use]
  if (!demand) return NONE
  const round = roundingOf(rule)
  const byUse = demandByUse(demand, need)
  const parts = [byUse, hallDemand(rule, demand, need)]
  const stipulated = {
    spaces: parts.reduce((sum, part) => sum + round(part.spaces), 0),
    cites: parts.flatMap((part) => part.cites),
  }
  const rounding = rule.fractionsRoundUp ?? rule.fractionsAboveHalfRoundUp
  const counted = byUse === NONE ? stipulated : withVisitors(rule, stipulated, round)
  const total = { spaces: counted.spaces, cites: [...counted.cites, ...(rounding ? [rounding] : [])] }
  const { largeBuildingSqmPerSpace, largerOfSumOrArea } = rule
  if (!need.large || !largeBuildingSqmPerSpace) return total
  const byArea = {
    spaces: Math.ceil(need.floorAreaSqm / largeBuildingSqmPerSpace.value),
    cites: [largeBuildingSqmPerSpace.cite, ...(largerOfSumOrArea ? [largerOfSumOrArea] : [])],
  }
  return byArea.spaces > total.spaces ? byArea : total
}

export function parkingSpaces(rules: readonly ParkingRule[], need: ParkingNeed): Sourced {
  const demand = rules.map((rule) => ruleDemand(rule, need)).reduce((most, d) => (d.spaces > most.spaces ? d : most), NONE)
  return { value: demand.spaces, cites: demand.cites }
}
