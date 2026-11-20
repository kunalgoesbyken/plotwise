import { describe, expect, it } from 'bun:test'
import fc from 'fast-check'
import { ASSUMPTIONS } from '@/solve/assumptions'
import { MAX_ROAD_WIDTH_M, PlotLimitsSchema, PlotSchema, type PlotLimitField } from './plot'

const ring = [
  [100.56, 13.74],
  [100.561, 13.74],
  [100.561, 13.741],
  [100.56, 13.741],
]

const valid = { ring, roads: [{ edge: 0, widthM: 16 }], buildingType: 'condo' }

describe('PlotSchema', () => {
  it('accepts a plot with at least one road edge', () => {
    expect(PlotSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects fewer than 3 vertices', () => {
    expect(PlotSchema.safeParse({ ...valid, ring: ring.slice(0, 2) }).success).toBe(false)
  })

  it('rejects a plot with no road', () => {
    expect(PlotSchema.safeParse({ ...valid, roads: [] }).success).toBe(false)
  })

  it('rejects a road on an edge the ring does not have', () => {
    expect(PlotSchema.safeParse({ ...valid, roads: [{ edge: 4, widthM: 16 }] }).success).toBe(false)
  })

  it('rejects two roads on the same edge', () => {
    const roads = [
      { edge: 1, widthM: 16 },
      { edge: 1, widthM: 10 },
    ]
    expect(PlotSchema.safeParse({ ...valid, roads }).success).toBe(false)
  })

  it('defaults to not being near a station, so plots saved before the flag existed stay valid', () => {
    expect(PlotSchema.parse(valid).nearStation).toBe(false)
    expect(PlotSchema.parse({ ...valid, nearStation: true }).nearStation).toBe(true)
    expect(PlotSchema.safeParse({ ...valid, nearStation: 'yes' }).success).toBe(false)
  })

  it('rejects a road wider than any real street, which would make the envelope unbounded', () => {
    for (const widthM of [MAX_ROAD_WIDTH_M + 1, 1e12, Number.MAX_VALUE, Infinity]) {
      expect(PlotSchema.safeParse({ ...valid, roads: [{ edge: 0, widthM }] }).success).toBe(false)
    }
    expect(PlotSchema.safeParse({ ...valid, roads: [{ edge: 0, widthM: MAX_ROAD_WIDTH_M }] }).success).toBe(true)
  })

  it('accepts a prescribed width only when it widens the road and stays within the widest street', () => {
    const road = (prescribedWidthM: number) => PlotSchema.safeParse({ ...valid, roads: [{ edge: 0, widthM: 9, prescribedWidthM }] }).success
    expect(road(18)).toBe(true)
    expect(road(MAX_ROAD_WIDTH_M)).toBe(true)
    for (const bad of [9, 6, 0, -1, MAX_ROAD_WIDTH_M + 1, Infinity, Number.NaN]) expect(road(bad)).toBe(false)
  })

  it('rejects a non-positive road width and an unknown building type', () => {
    expect(PlotSchema.safeParse({ ...valid, roads: [{ edge: 0, widthM: 0 }] }).success).toBe(false)
    expect(PlotSchema.safeParse({ ...valid, buildingType: 'castle' }).success).toBe(false)
  })
})

describe('limits entered for a plot', () => {
  const withLimits = (limits: object) => PlotSchema.safeParse({ ...valid, limits }).success

  it('accepts a plot without limits and one with every limit in range', () => {
    expect(withLimits({})).toBe(true)
    expect(PlotSchema.parse(valid).limits).toBeUndefined()
    expect(withLimits({ maxGfaSqm: 5000, maxHeightM: 40, maxStoreys: 12, maxCoverageShare: 0.6, roadSetbackM: 0, boundarySetbackM: 3 })).toBe(true)
  })

  it('rejects limits that are not positive, not finite or beyond any real plot', () => {
    for (const bad of [0, -1, Infinity, NaN]) {
      expect(withLimits({ maxGfaSqm: bad })).toBe(false)
      expect(withLimits({ maxHeightM: bad })).toBe(false)
    }
    expect(withLimits({ maxStoreys: 2.5 })).toBe(false)
    expect(withLimits({ maxCoverageShare: 1.01 })).toBe(false)
    expect(withLimits({ roadSetbackM: -0.5 })).toBe(false)
  })

  const MAXIMA: Readonly<Partial<Record<PlotLimitField, number>>> = {
    maxGfaSqm: ASSUMPTIONS.plotMaxGfaSqm.value,
    maxFar: ASSUMPTIONS.plotMaxFar.value,
    maxHeightM: ASSUMPTIONS.plotMaxHeightM.value,
    maxStoreys: ASSUMPTIONS.plotMaxStoreys.value,
    roadSetbackM: ASSUMPTIONS.plotMaxSetbackM.value,
    boundarySetbackM: ASSUMPTIONS.plotMaxSetbackM.value,
    parkingSqmPerSpace: ASSUMPTIONS.plotMaxParkingSqmPerSpace.value,
  }

  it.each(Object.entries(MAXIMA))('accepts %s up to its sourced maximum and refuses anything above it', (field, max) => {
    expect(withLimits({ [field]: max })).toBe(true)
    fc.assert(fc.property(fc.double({ min: max, max: Number.MAX_VALUE, minExcluded: true, noNaN: true }), (over) => !withLimits({ [field]: over })))
  })

  it('bounds every limit a plot can be given', () => {
    expect(Object.keys(MAXIMA).sort()).toEqual(Object.keys(PlotLimitsSchema.shape).filter((f) => !f.endsWith('Share')).sort())
  })

  it('refuses the million-metre height that once built a 320,000-storey design', () => {
    expect(withLimits({ maxFar: 100, maxHeightM: 1_000_000 })).toBe(false)
  })
})
