import { describe, expect, it } from 'bun:test'
import { PlotSchema } from './plot'

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

  it('rejects a non-positive road width and an unknown building type', () => {
    expect(PlotSchema.safeParse({ ...valid, roads: [{ edge: 0, widthM: 0 }] }).success).toBe(false)
    expect(PlotSchema.safeParse({ ...valid, buildingType: 'castle' }).success).toBe(false)
  })
})
