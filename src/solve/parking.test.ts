import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import { loadPack, type ParkingRule } from '@/rules'
import { band, value } from '@/rules/test-packs'
import { parkingSpaces, type ParkingNeed } from './parking'

const pack = loadPack('bkk-y9')
const [bylaw, ministerial] = (['bangkokBylaw', 'ministerialInnerBangkok'] as const).map(
  (scope) => pack.parking.find((r) => r.scope === scope) as ParkingRule,
)

const need = (overrides: Partial<ParkingNeed>): ParkingNeed => ({
  use: 'condo',
  floorAreaSqm: 0,
  large: false,
  units: 0,
  unitSqm: 35,
  rooms: 0,
  lobbySqm: 0,
  officeSqm: 0,
  ...overrides,
})

describe('parking spaces', () => {
  it('asks a condo with units of 60 m² or more for one space per unit', () => {
    expect(parkingSpaces([bylaw], need({ units: 40, unitSqm: 60 })).value).toBe(40)
    expect(parkingSpaces([bylaw], need({ units: 40, unitSqm: 59 })).value).toBe(0)
  })

  it('asks a large building for one space per 120 m² when that is more than the per-use count', () => {
    const condo = need({ units: 100, unitSqm: 35, floorAreaSqm: 12000, large: true })
    expect(parkingSpaces([bylaw], condo)).toMatchObject({ value: 100, cites: expect.arrayContaining([bylaw.largeBuildingSqmPerSpace!.cite]) })
    expect(parkingSpaces([bylaw], { ...condo, units: 150, unitSqm: 60 }).value).toBe(150)
  })

  it('counts hotel rooms in tiers under the bylaw and lobby area under the ministerial rule', () => {
    const hotel = need({ use: 'hotel', rooms: 130, lobbySqm: 0 })
    expect(parkingSpaces([bylaw], hotel).value).toBe(10 + 70 / 5 + 30 / 10)
    expect(parkingSpaces([bylaw], need({ use: 'hotel', rooms: 31 })).value).toBe(11)
    expect(parkingSpaces([ministerial], need({ use: 'hotel', rooms: 130, lobbySqm: 300 })).value).toBe(30)
    expect(parkingSpaces([ministerial], need({ use: 'hotel', rooms: 130, lobbySqm: 299 })).value).toBe(0)
  })

  it('takes the higher count when both rules apply', () => {
    const hotel = need({ use: 'hotel', rooms: 60, lobbySqm: 400 })
    const both = parkingSpaces([bylaw, ministerial], hotel).value
    expect(both).toBe(Math.max(parkingSpaces([bylaw], hotel).value, parkingSpaces([ministerial], hotel).value))
  })

  it('rounds each use up to a whole space', () => {
    expect(parkingSpaces([bylaw], need({ use: 'office', officeSqm: 301 })).value).toBe(6)
    expect(parkingSpaces([bylaw], need({ use: 'office', officeSqm: 299 })).value).toBe(0)
  })

  it('never falls when the building grows', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2000 }), fc.integer({ min: 0, max: 500 }), (rooms, extra) => {
        const at = (r: number) => parkingSpaces([bylaw, ministerial], need({ use: 'hotel', rooms: r, lobbySqm: r })).value
        expect(at(rooms + extra)).toBeGreaterThanOrEqual(at(rooms))
      }),
    )
  })
})

describe('parking demand shapes beyond Bangkok', () => {
  const bySize: ParkingRule = {
    ...bylaw,
    condo: {
      kind: 'perUnitBySize',
      bands: [
        { unitSqm: band(undefined, 50), spacesPerUnit: value(0.5) },
        { unitSqm: band(50, 100), spacesPerUnit: value(1) },
        { unitSqm: band(100), spacesPerUnit: value(2) },
      ],
    },
    office: { kind: 'perGrossArea', sqmPerSpace: value(100) },
    hallSqmPerSpace: undefined,
    largeBuildingSqmPerSpace: undefined,
  }

  it('counts spaces per unit by the size band the unit falls in', () => {
    expect(parkingSpaces([bySize], need({ units: 40, unitSqm: 49 })).value).toBe(20)
    expect(parkingSpaces([bySize], need({ units: 40, unitSqm: 50 })).value).toBe(40)
    expect(parkingSpaces([bySize], need({ units: 40, unitSqm: 120, large: true, floorAreaSqm: 50_000 })).value).toBe(80)
  })

  it('counts one space per stated area of gross floor area, rounded up', () => {
    expect(parkingSpaces([bySize], need({ use: 'office', floorAreaSqm: 1001 })).value).toBe(11)
  })
})

describe('parking by tenements per space, with visitors', () => {
  const cite = value(0).cite
  const byTenements: ParkingRule = {
    scope: 'mumbaiTable21',
    appliesWhere: cite,
    condo: {
      kind: 'unitsPerSpaceBySize',
      bands: [
        { unitSqm: band(undefined, 45), unitsPerSpace: value(4) },
        { unitSqm: band(45, 90), unitsPerSpace: value(1) },
        { unitSqm: band(90), unitsPerSpace: value(0.5) },
      ],
    },
    visitors: { share: value(0.25), min: value(1) },
    fractionsAboveHalfRoundUp: cite,
  }

  it('gives one space for every so many tenements of the size, plus a visitor share of at least one', () => {
    expect(parkingSpaces([byTenements], need({ units: 40, unitSqm: 35 })).value).toBe(10 + 2)
    expect(parkingSpaces([byTenements], need({ units: 2, unitSqm: 35 })).value).toBe(0 + 1)
    expect(parkingSpaces([byTenements], need({ units: 10, unitSqm: 100 })).value).toBe(20 + 5)
    expect(parkingSpaces([byTenements], need({ units: 0, unitSqm: 35 })).value).toBe(0)
  })

  it('rounds a fraction up only when it is more than half', () => {
    expect(parkingSpaces([byTenements], need({ units: 10, unitSqm: 35 })).value).toBe(2 + 1)
    expect(parkingSpaces([byTenements], need({ units: 11, unitSqm: 35 })).value).toBe(3 + 1)
  })

  it('never asks for fewer spaces as tenements are added', () => {
    fc.assert(
      fc.property(fc.nat(500), fc.double({ min: 20, max: 150, noNaN: true }), (units, unitSqm) => {
        const fewer = parkingSpaces([byTenements], need({ units, unitSqm })).value
        expect(parkingSpaces([byTenements], need({ units: units + 1, unitSqm })).value).toBeGreaterThanOrEqual(fewer)
      }),
    )
  })
})
