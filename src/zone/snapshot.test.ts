import { describe, expect, it } from 'bun:test'
import fc from 'fast-check'
import { localFrame, type LngLat } from '@/geo/projection'
import { EXAMPLE_PLOT } from '@/plot/example-plot'
import { COMMITTED_SNAPSHOT as snapshot } from './__fixtures__/committed-snapshot'
import { fetchZoneSnapshot, snapshotVerdict, type ZoneSnapshot } from './snapshot'
import { ZONE_SOURCES } from './sources'

const { bkk } = ZONE_SOURCES
const BROWN_9 = 'brown zone 9 (very high-density residential)'

const square = (centre: LngLat, sideM: number): LngLat[] => {
  const frame = localFrame(centre)
  const half = sideM / 2
  return (
    [
      [-half, -half],
      [half, -half],
      [half, half],
      [-half, half],
    ] as const
  ).map(frame.toLngLat)
}

const westernmostCorner = ({ features }: ZoneSnapshot): LngLat =>
  features.flatMap(({ rings }) => rings.flat()).reduce((west, vertex) => (vertex[0] < west[0] ? vertex : west))

describe('the committed BMA brown-zone snapshot', () => {
  it('holds every brown zone 9 polygon of the layer, dated and sourced', () => {
    expect(snapshot.layer).toBe(bkk.layer.url)
    expect(snapshot.where).toBe(`${bkk.layer.zoneField}='ย.๙'`)
    expect(snapshot.url.startsWith(`${bkk.layer.url}/query?`)).toBe(true)
    expect(snapshot.fetchedAt).toBe('2026-11-20T14:55:43.127073Z')
    expect(snapshot.featureCount).toBe(31)
    expect(snapshot.features).toHaveLength(31)
    expect(new Set(snapshot.features.map(({ code }) => code))).toEqual(new Set(['ย.๙']))
  })
})

describe('snapshotVerdict', () => {
  it('puts the example plot inside the brown zone', () => {
    expect(snapshotVerdict(bkk, snapshot, EXAMPLE_PLOT.ring)).toEqual({ status: 'inside', zone: BROWN_9 })
  })

  it('puts a plot far from any brown polygon outside, without naming a zone it does not hold', () => {
    const chatuchakPark = square([100.5527, 13.8032], 40)
    expect(snapshotVerdict(bkk, snapshot, chatuchakPark)).toEqual({ status: 'outside', zone: null, covered: BROWN_9 })
  })

  it('finds a plot on the edge of the brown zone straddling it, with the brown part named and the rest not', () => {
    const plot = square(westernmostCorner(snapshot), 20)
    const verdict = snapshotVerdict(bkk, snapshot, plot)
    if (verdict.status !== 'straddles') throw new Error(`expected a straddle, got ${verdict.status}`)
    expect(verdict.parts.map(({ zone }) => zone).sort()).toEqual([BROWN_9, null].sort())
    expect(verdict.parts.reduce((sum, { share }) => sum + share, 0)).toBeCloseTo(1, 6)
  })

  it('answers every small plot in Bangkok with a definite verdict', () => {
    const [west, south, east, north] = bkk.coverage
    fc.assert(
      fc.property(fc.double({ min: west, max: east, noNaN: true }), fc.double({ min: south, max: north, noNaN: true }), (lng, lat) => {
        expect(snapshotVerdict(bkk, snapshot, square([lng, lat], 30)).status).not.toBe('unknown')
      }),
      { numRuns: 50 },
    )
  })
})

describe('fetchZoneSnapshot', () => {
  const respondWith = (body: unknown, init?: ResponseInit) => (() => Promise.resolve(Response.json(body, init))) as unknown as typeof fetch

  it('reads the snapshot from its path on this site', async () => {
    const requested: string[] = []
    const server = ((url: string) => {
      requested.push(url)
      return Promise.resolve(Response.json(snapshot))
    }) as unknown as typeof fetch
    const read: ZoneSnapshot = await fetchZoneSnapshot(bkk, server)
    expect(requested).toEqual([bkk.snapshot])
    expect(read).toEqual(snapshot)
  })

  it('refuses a failed or malformed answer', async () => {
    await expect(fetchZoneSnapshot(bkk, respondWith(snapshot, { status: 404 }))).rejects.toThrow('HTTP 404')
    await expect(fetchZoneSnapshot(bkk, respondWith({ features: 'none' }))).rejects.toThrow()
  })
})
