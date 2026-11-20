import { describe, expect, it } from 'bun:test'
import fc from 'fast-check'
import type { LngLat } from '@/geo/projection'
import fixture from './__fixtures__/nyc-lexington.arcgis.json'
import { RECORDED_LAYER } from './__fixtures__/recorded-layer'
import { parseZoneFeatures, type ZoneFeature } from './arcgis'
import { ZONE_GENERALISATION_DEGREES, ZONE_SLIVER_SHARE } from './assumptions'
import { zoneShares } from './shares'

const WEST = 100.5755
const SOUTH = 13.7789
const WIDTH = 0.0004
const HEIGHT = 0.0003

const plot: LngLat[] = [
  [WEST, SOUTH],
  [WEST + WIDTH, SOUTH],
  [WEST + WIDTH, SOUTH + HEIGHT],
  [WEST, SOUTH + HEIGHT],
]

const clockwiseBox = (west: number, east: number, south = SOUTH - 0.01, north = SOUTH + HEIGHT + 0.01): LngLat[] => [
  [west, south],
  [west, north],
  [east, north],
  [east, south],
]

const feature = (code: string, ...rings: LngLat[][]): ZoneFeature => ({ code, rings })

const shareOf = (code: string, shares: ReturnType<typeof zoneShares>) => shares.find((entry) => entry.code === code)?.share ?? 0

describe('zoneShares', () => {
  it('gives a plot wholly inside one zone a share of one', () => {
    const [entry] = zoneShares(plot, [feature('A', clockwiseBox(WEST - 0.01, WEST + 0.01))])
    expect(entry.share).toBeCloseTo(1, 6)
  })

  it('gives a zone the plot never touches a share of zero', () => {
    const [entry] = zoneShares(plot, [feature('A', clockwiseBox(WEST + 0.01, WEST + 0.02))])
    expect(entry.share).toBe(0)
  })

  it('splits the plot by the line between two zones', () => {
    fc.assert(
      fc.property(fc.double({ min: 0.01, max: 0.99, noNaN: true }), (fraction) => {
        const cut = WEST + WIDTH * fraction
        const shares = zoneShares(plot, [
          feature('west', clockwiseBox(WEST - 0.01, cut)),
          feature('east', clockwiseBox(cut, WEST + 0.01)),
        ])
        expect(shareOf('west', shares)).toBeCloseTo(fraction, 4)
        expect(shareOf('east', shares)).toBeCloseTo(1 - fraction, 4)
      }),
    )
  })

  it('moves a share by less than the sliver when the server generalises a boundary by its largest offset', () => {
    const cut = WEST + WIDTH / 2
    const exact = zoneShares(plot, [feature('west', clockwiseBox(WEST - 0.01, cut))])
    const generalised = zoneShares(plot, [feature('west', clockwiseBox(WEST - 0.01, cut + ZONE_GENERALISATION_DEGREES.value))])
    expect(Math.abs(shareOf('west', generalised) - shareOf('west', exact))).toBeLessThan(ZONE_SLIVER_SHARE.value)
  })

  it('adds up the parts of a zone that has several features or rings', () => {
    const cut = WEST + WIDTH * 0.25
    const shares = zoneShares(plot, [
      feature('A', clockwiseBox(WEST - 0.01, cut)),
      feature('A', clockwiseBox(WEST + WIDTH * 0.75, WEST + 0.01)),
      feature('B', clockwiseBox(cut, WEST + WIDTH * 0.5), clockwiseBox(WEST + WIDTH * 0.5, WEST + WIDTH * 0.75)),
    ])
    expect(shareOf('A', shares)).toBeCloseTo(0.5, 4)
    expect(shareOf('B', shares)).toBeCloseTo(0.5, 4)
  })

  it('leaves out the area of a hole in the zone', () => {
    fc.assert(
      fc.property(fc.double({ min: 0.05, max: 0.95, noNaN: true }), (fraction) => {
        const hole = clockwiseBox(WEST, WEST + WIDTH * fraction).reverse()
        const [entry] = zoneShares(plot, [feature('A', clockwiseBox(WEST - 0.01, WEST + 0.01), hole)])
        expect(entry.share).toBeCloseTo(1 - fraction, 4)
      }),
    )
  })

  it('counts an island inside a hole as zone again', () => {
    const hole = clockwiseBox(WEST + WIDTH * 0.1, WEST + WIDTH * 0.9, SOUTH + HEIGHT * 0.1, SOUTH + HEIGHT * 0.9).reverse()
    const island = clockwiseBox(WEST + WIDTH * 0.4, WEST + WIDTH * 0.6, SOUTH + HEIGHT * 0.4, SOUTH + HEIGHT * 0.6)
    const [entry] = zoneShares(plot, [feature('A', clockwiseBox(WEST - 0.01, WEST + 0.01), hole, island)])
    expect(entry.share).toBeCloseTo(1 - 0.8 * 0.8 + 0.2 * 0.2, 4)
  })

  it('does not depend on which way the plot is wound', () => {
    const zone = [feature('A', clockwiseBox(WEST - 0.01, WEST + WIDTH * 0.3))]
    expect(shareOf('A', zoneShares([...plot].reverse(), zone))).toBeCloseTo(shareOf('A', zoneShares(plot, zone)), 6)
  })
})

describe('zoneShares on a recorded ArcGIS response', () => {
  const features = parseZoneFeatures(RECORDED_LAYER, fixture)
  const [west, south] = [-73.964096, 40.7658]
  const [dLng, dLat] = [0.00012, 0.00012]
  const straddling: LngLat[] = [
    [west - dLng, south - dLat],
    [west + dLng, south - dLat],
    [west + dLng, south + dLat],
    [west - dLng, south + dLat],
  ]

  it('finds the plot straddling two districts and nothing else', () => {
    const shares = zoneShares(straddling, features).filter(({ share }) => share > 0)
    expect(shares.map(({ code }) => code).sort()).toEqual(['C1-9', 'R8B'])
    expect(shares.reduce((sum, { share }) => sum + share, 0)).toBeCloseTo(1, 3)
  })

  it('finds a plot inside the narrow district to lie wholly in it', () => {
    const inside: LngLat[] = [
      [-73.96355, 40.76575],
      [-73.96345, 40.76575],
      [-73.96345, 40.76585],
      [-73.96355, 40.76585],
    ]
    const shares = zoneShares(inside, features).filter(({ share }) => share > 0)
    expect(shares).toHaveLength(1)
    expect(shares[0].share).toBeCloseTo(1, 6)
  })
})
