import type { Cite } from '@/rules'
import { ASSUMPTIONS, homeSqmOf, isLarge, parkingSpaces, type Building, type ParkingNeed, type Solution } from '@/solve'

export type Yield =
  | { readonly kind: 'units'; readonly count: number }
  | { readonly kind: 'rooms'; readonly count: number }
  | { readonly kind: 'netArea'; readonly sqm: number }

export type Programme = {
  readonly builtSqm: number
  readonly farSqm: number
  readonly parkingSpaces: number
  readonly parkingSqm: number
  readonly parkingCites: readonly Cite[]
  readonly yield: Yield
  readonly conditionMeasure: number
}

const BAY_SQM = ASSUMPTIONS.parkingGrossSqmPerSpace.value

function needFor(solution: Solution, building: Building, grossSqm: number): ParkingNeed {
  const use = solution.plot.buildingType
  const base = { use, floorAreaSqm: grossSqm, large: isLarge(solution.pack, building), units: 0, rooms: 0, lobbySqm: 0, officeSqm: 0 }
  const unitSqm = homeSqmOf(solution)
  switch (use) {
    case 'condo':
      return { ...base, unitSqm, units: Math.floor((grossSqm * ASSUMPTIONS.netToGross.condo.value) / unitSqm) }
    case 'hotel': {
      const rooms = Math.floor(grossSqm / ASSUMPTIONS.hotelGrossSqmPerRoom.value)
      return { ...base, unitSqm, rooms, lobbySqm: rooms * ASSUMPTIONS.hotelLobbySqmPerRoom.value }
    }
    case 'office':
      return { ...base, unitSqm, officeSqm: grossSqm * ASSUMPTIONS.netToGross.office.value }
  }
}

function yieldOf(need: ParkingNeed): Yield {
  switch (need.use) {
    case 'condo':
      return { kind: 'units', count: need.units }
    case 'hotel':
      return { kind: 'rooms', count: need.rooms }
    case 'office':
      return { kind: 'netArea', sqm: need.officeSqm }
  }
}

function conditionMeasure(solution: Solution, building: Building, need: ParkingNeed): number {
  if (need.use === 'hotel') return need.rooms
  return solution.readings['office-operating-area'] === 'net' ? need.officeSqm : building.floorAreaSqm
}

function spacesFor(solution: Solution, building: Building): number {
  const demand = (spaces: number) =>
    parkingSpaces(solution.limits.parking.rules, needFor(solution, building, Math.max(0, building.floorAreaSqm - spaces * BAY_SQM))).value
  let [low, high] = [0, demand(0)]
  while (low < high) {
    const mid = Math.floor((low + high) / 2)
    if (mid >= demand(mid)) high = mid
    else low = mid + 1
  }
  return low
}

export function programme(solution: Solution, building: Building): Programme {
  const spaces = spacesFor(solution, building)
  const parkingSqm = spaces * BAY_SQM
  const grossSqm = Math.max(0, building.floorAreaSqm - parkingSqm)
  const need = needFor(solution, building, grossSqm)
  const counts = solution.readings['gfa-includes-parking'] === 'counts'
  return {
    builtSqm: building.floorAreaSqm,
    farSqm: counts ? building.floorAreaSqm : grossSqm,
    parkingSpaces: spaces,
    parkingSqm,
    parkingCites: parkingSpaces(solution.limits.parking.rules, need).cites,
    yield: yieldOf(need),
    conditionMeasure: conditionMeasure(solution, building, need),
  }
}
