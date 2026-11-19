import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import { setbackSeeds, starPolygon } from './arbitraries'
import { difference } from './clip'
import { GeometryError } from './errors'
import { normalizeRing, totalArea } from './polygon'
import { tieredEnvelope, type Tier } from './volume'

const rectangle = normalizeRing([
  [0, 0],
  [20, 0],
  [20, 30],
  [0, 30],
])

const uniform = (d: number) => [d, d, d, d]

describe('tieredEnvelope', () => {
  it('stacks one prism per tier with its own setbacks', () => {
    const volume = tieredEnvelope(rectangle, [
      { fromM: 0, toM: 10, setbacks: uniform(1) },
      { fromM: 10, toM: 30, setbacks: uniform(3) },
    ])
    expect(volume.map((p) => [p.baseM, p.topM, totalArea(p.polygons)])).toEqual([
      [0, 10, 18 * 28],
      [10, 30, 14 * 24],
    ])
  })

  it('never lets an upper tier poke outside a lower one', () => {
    const volume = tieredEnvelope(rectangle, [
      { fromM: 0, toM: 10, setbacks: [1, 1, 1, 6] },
      { fromM: 10, toM: 30, setbacks: [3, 3, 3, 1] },
    ])
    expect(totalArea(volume[1].polygons)).toBeCloseTo((17 - 6) * (27 - 3), 6)
  })

  it('stops at the first tier whose envelope vanishes', () => {
    const volume = tieredEnvelope(rectangle, [
      { fromM: 0, toM: 10, setbacks: uniform(1) },
      { fromM: 10, toM: 20, setbacks: uniform(12) },
      { fromM: 20, toM: 30, setbacks: uniform(2) },
    ])
    expect(volume.map((p) => p.topM)).toEqual([10])
  })

  it('returns no volume for no tiers', () => {
    expect(tieredEnvelope(rectangle, [])).toEqual([])
  })

  it('rejects tiers that are empty, overlap or leave a gap', () => {
    const bad: Tier[][] = [
      [{ fromM: 5, toM: 5, setbacks: uniform(1) }],
      [
        { fromM: 0, toM: 10, setbacks: uniform(1) },
        { fromM: 8, toM: 20, setbacks: uniform(1) },
      ],
      [
        { fromM: 0, toM: 10, setbacks: uniform(1) },
        { fromM: 12, toM: 20, setbacks: uniform(1) },
      ],
      [{ fromM: 0, toM: Number.NaN, setbacks: uniform(1) }],
    ]
    for (const tiers of bad) expect(() => tieredEnvelope(rectangle, tiers)).toThrow(GeometryError)
  })

  it('keeps every prism inside the one below it on random plots', () => {
    fc.assert(
      fc.property(starPolygon(20), fc.array(setbackSeeds(10), { minLength: 1, maxLength: 4 }), (points, seedsPerTier) => {
        const plot = normalizeRing(points)
        const tiers = seedsPerTier.map((seeds, i) => ({ fromM: i * 10, toM: (i + 1) * 10, setbacks: seeds.slice(0, plot.length) }))
        const volume = tieredEnvelope(plot, tiers)
        volume.slice(1).forEach((prism, i) => {
          expect(prism.baseM).toBe(volume[i].topM)
          expect(totalArea(difference(prism.polygons, volume[i].polygons))).toBeLessThan(1e-3)
        })
      }),
      { numRuns: 100 },
    )
  })
})
