import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import { setbackSeeds, starPolygon } from './arbitraries'
import { difference } from './clip'
import { GeometryError } from './errors'
import { floorPlates } from './floors'
import { normalizeRing, totalArea, type Polygon } from './polygon'
import { tieredEnvelope } from './volume'

const rectangle = normalizeRing([
  [0, 0],
  [20, 0],
  [20, 30],
  [0, 30],
])

const uniform = (d: number) => [d, d, d, d]
const cents = (sqm: number) => Math.round(sqm * 100)
const twoTiers = tieredEnvelope(rectangle, [
  { fromM: 0, toM: 10, setbacks: uniform(1) },
  { fromM: 10, toM: 30, setbacks: uniform(3) },
])

const square = (x: number, y: number, size: number): Polygon => ({
  outer: [
    [x, y],
    [x + size, y],
    [x + size, y + size],
    [x, y + size],
  ],
  holes: [],
})

describe('floorPlates', () => {
  it('fills a single prism with whole floors', () => {
    const plates = floorPlates(tieredEnvelope(rectangle, [{ fromM: 0, toM: 30, setbacks: [3, 1.5, 1.5, 1.5] }]), 3)
    expect(plates.floors).toHaveLength(10)
    expect(plates.floors.every((f) => f.areaSqm === 433.5)).toBe(true)
    expect(plates.gfaSqm).toBe(4335)
    expect(plates.footprintSqm).toBe(433.5)
  })

  it('uses the stricter tier for a floor that crosses a tier line and drops a floor that would poke out of the top', () => {
    const plates = floorPlates(twoTiers, 4)
    expect(plates.floors.map((f) => [f.level, f.baseM, f.topM, f.areaSqm])).toEqual([
      [0, 0, 4, 504],
      [1, 4, 8, 504],
      [2, 8, 12, 336],
      [3, 12, 16, 336],
      [4, 16, 20, 336],
      [5, 20, 24, 336],
      [6, 24, 28, 336],
    ])
    expect(plates.gfaSqm).toBe(2 * 504 + 5 * 336)
  })

  it('clips every floor to a footprint polygon', () => {
    const plates = floorPlates(twoTiers, 3, { footprint: [square(-5, -5, 10)] })
    expect(plates.footprintSqm).toBe(16)
    expect(plates.floors[0].areaSqm).toBe(16)
    expect(plates.floors.at(-1)?.areaSqm).toBe(4)
  })

  it('shrinks the footprint to an area cap while keeping its shape inside the envelope', () => {
    const plates = floorPlates(twoTiers, 3, { maxFootprintSqm: 300 })
    expect(plates.footprintSqm).toBeLessThanOrEqual(300)
    expect(plates.footprintSqm).toBeGreaterThan(299)
    expect(plates.floors.every((f) => f.areaSqm <= plates.footprintSqm)).toBe(true)
    expect(totalArea(difference(plates.footprint, twoTiers[0].polygons))).toBeLessThan(1e-3)
  })

  it('returns nothing for an empty volume or a cap of zero', () => {
    expect(floorPlates([], 3)).toEqual({ footprint: [], footprintSqm: 0, floors: [], gfaSqm: 0 })
    expect(floorPlates(twoTiers, 3, { maxFootprintSqm: 0 }).gfaSqm).toBe(0)
  })

  it('rejects a non-positive floor height or a negative cap', () => {
    expect(() => floorPlates(twoTiers, 0)).toThrow(GeometryError)
    expect(() => floorPlates(twoTiers, Number.NaN)).toThrow(GeometryError)
    expect(() => floorPlates(twoTiers, 3, { maxFootprintSqm: -1 })).toThrow(GeometryError)
  })

  it('adds floor areas up exactly to the total and keeps each floor inside its envelope', () => {
    fc.assert(
      fc.property(
        starPolygon(20),
        fc.array(setbackSeeds(8), { minLength: 1, maxLength: 3 }),
        fc.double({ min: 2.8, max: 4.5, noNaN: true }),
        fc.option(fc.double({ min: 0, max: 5000, noNaN: true }), { nil: undefined }),
        (points, seedsPerTier, floorToFloorM, maxFootprintSqm) => {
          const plot = normalizeRing(points)
          const tiers = seedsPerTier.map((seeds, i) => ({ fromM: i * 12, toM: (i + 1) * 12, setbacks: seeds.slice(0, plot.length) }))
          const volume = tieredEnvelope(plot, tiers)
          const plates = floorPlates(volume, floorToFloorM, { maxFootprintSqm })
          expect(cents(plates.gfaSqm)).toBe(plates.floors.reduce((sum, f) => sum + cents(f.areaSqm), 0))
          for (const floor of plates.floors) {
            const prism = volume.findLast((p) => p.baseM < floor.topM)
            expect(Math.abs(floor.areaSqm - totalArea(floor.polygons))).toBeLessThanOrEqual(0.005)
            expect(floor.areaSqm).toBeLessThanOrEqual(plates.footprintSqm)
            expect(totalArea(difference(floor.polygons, prism?.polygons ?? []))).toBeLessThan(1e-3)
            expect(floor.topM).toBeLessThanOrEqual((volume.at(-1)?.topM ?? 0) + 1e-3)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
