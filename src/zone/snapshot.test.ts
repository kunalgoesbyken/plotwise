import { describe, expect, it } from 'bun:test'
import fc from 'fast-check'
import { localFrame, type LngLat, type LocalFrame, type Vec2 } from '@/geo/projection'
import { EXAMPLE_PLOT } from '@/plot/example-plot'
import { MAX_BBOX_SIDE_M } from '@/site/assumptions'
import { COMMITTED_SNAPSHOT as snapshot } from './__fixtures__/committed-snapshot'
import { ZONE_SLIVER_SHARE, ZONE_SNAPSHOT_ATTEMPTS } from './assumptions'
import { zoneShares } from './shares'
import { createSnapshotLoader, fetchZoneSnapshot, snapshotVerdict, snapshotZone, type ZoneSnapshot } from './snapshot'
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

  it('measures the brown part of a plot near a brown boundary as the sum of its quarters, to within the sliver share', () => {
    const vertices = snapshot.features.flatMap(({ rings }) => rings.flat())
    const box = (frame: LocalFrame, [x0, y0]: Vec2, [x1, y1]: Vec2): LngLat[] => ([[x0, y0], [x1, y0], [x1, y1], [x0, y1]] as Vec2[]).map(frame.toLngLat)
    const brownSqm = (plot: LngLat[], sideM: number) => zoneShares(plot, snapshot.features).reduce((sum, { share }) => sum + share, 0) * sideM ** 2
    fc.assert(
      fc.property(fc.nat({ max: vertices.length - 1 }), fc.double({ min: -15, max: 15, noNaN: true }), fc.double({ min: -15, max: 15, noNaN: true }), (index, dx, dy) => {
        const frame = localFrame(localFrame(vertices[index]).toLngLat([dx, dy]))
        const whole = brownSqm(box(frame, [-15, -15], [15, 15]), 30)
        const quarters = ([[-15, -15], [0, -15], [-15, 0], [0, 0]] as Vec2[]).map(([x, y]) => brownSqm(box(frame, [x, y], [x + 15, y + 15]), 15))
        expect(Math.abs(whole - quarters.reduce((sum, sqm) => sum + sqm, 0))).toBeLessThan(ZONE_SLIVER_SHARE.value * 30 ** 2)
      }),
      { numRuns: 50 },
    )
  })
})

describe('snapshotZone', () => {
  it('dates the snapshot verdict and names its source', () => {
    expect(snapshotZone(EXAMPLE_PLOT.ring, 'bkk', snapshot)).toEqual({
      verdict: { status: 'inside', zone: BROWN_9 },
      asOf: snapshot.fetchedAt,
      source: bkk,
    })
  })

  it('does not judge an outline larger than a plot', () => {
    expect(snapshotZone(square(EXAMPLE_PLOT.ring[0], MAX_BBOX_SIDE_M.value * 2), 'bkk', snapshot)).toBeNull()
  })

  it('does not judge a plot outside the region of the snapshot', () => {
    expect(snapshotZone(square([77.59, 12.97], 30), 'bkk', snapshot)).toBeNull()
  })
})

describe('createSnapshotLoader', () => {
  const loader = (outcomes: readonly ('ok' | 'fail')[]) => {
    let calls = 0
    const load = createSnapshotLoader(() => {
      const outcome = outcomes[calls++] ?? 'ok'
      return outcome === 'ok' ? Promise.resolve(snapshot) : Promise.reject(new Error('HTTP 503'))
    })
    return { load, calls: () => calls }
  }

  it('shares one request between callers and keeps the snapshot it read', async () => {
    const { load, calls } = loader(['ok'])
    const [first, second] = await Promise.all([load('bkk'), load('bkk')])
    expect(first).toBe(snapshot)
    expect(second).toBe(snapshot)
    await load('bkk')
    expect(calls()).toBe(1)
  })

  it('tries again at once when a request fails, so one hiccup is ridden out', async () => {
    const { load, calls } = loader(['fail'])
    expect(await load('bkk')).toBe(snapshot)
    expect(calls()).toBe(2)
  })

  it('forgets a snapshot it could not read, so the next check asks again', async () => {
    const { load, calls } = loader(Array.from({ length: ZONE_SNAPSHOT_ATTEMPTS.value }, () => 'fail' as const))
    await expect(load('bkk')).rejects.toThrow('HTTP 503')
    expect(calls()).toBe(ZONE_SNAPSHOT_ATTEMPTS.value)
    expect(await load('bkk')).toBe(snapshot)
    expect(calls()).toBe(ZONE_SNAPSHOT_ATTEMPTS.value + 1)
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

  it('gives up on a host that does not answer within the timeout', async () => {
    const silent = ((_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal?.reason)))) as unknown as typeof fetch
    const started = performance.now()
    await expect(fetchZoneSnapshot(bkk, silent, 30)).rejects.toBeDefined()
    expect(performance.now() - started).toBeLessThan(1_000)
  })
})
