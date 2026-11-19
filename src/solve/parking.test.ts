import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import { loadPack, type ParkingRule } from '@/rules'
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
    expect(parkingSpaces([bylaw], condo)).toMatchObject({ value: 100, cites: expect.arrayContaining([bylaw.largeBuildingSqmPerSpace.cite]) })
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
