import { describe, expect, it } from 'bun:test'
import type { LngLat } from '@/geo/projection'
import { ZONE_ANSWER_MEMORY_MS, ZONE_UNREACHABLE_MEMORY_MS } from './assumptions'
import { MAX_BBOX_SIDE_M } from '@/site/assumptions'
import { createZoneLookup } from './lookup'
import { ZONE_SOURCES } from './sources'

const bangkokPlot: LngLat[] = [
  [100.5755, 13.7789],
  [100.5759, 13.7789],
  [100.5759, 13.7792],
  [100.5755, 13.7792],
]

const otherBangkokPlot: LngLat[] = bangkokPlot.map(([lng, lat]) => [lng, lat + 0.0001])

const BROWN_ZONE = 'ย.๙'
const BLUE_ZONE = 'ส.'
const around = (lng: number, lat: number) => [[lng - 0.01, lat - 0.01], [lng - 0.01, lat + 0.01], [lng + 0.01, lat + 0.01], [lng + 0.01, lat - 0.01], [lng - 0.01, lat - 0.01]]

const layerAnswer = (code: string) => ({
  features: [{ attributes: { [ZONE_SOURCES.bkk.layer.zoneField]: code }, geometry: { rings: [around(100.5757, 13.779)] } }],
})

const bangalorePlot: LngLat[] = [
  [77.59, 12.97],
  [77.5903, 12.97],
  [77.5903, 12.9703],
]

function server(respond: () => Promise<Response>) {
  const calls: string[] = []
  const fetchImpl = ((url: string) => {
    calls.push(url)
    return respond()
  }) as unknown as typeof fetch
  return { calls, fetchImpl }
}

const answer = (code: string) => () => Promise.resolve(Response.json(layerAnswer(code)))
const down = () => Promise.resolve(Response.json({}, { status: 503 }))

function clock(start = 1_000) {
  let time = start
  return { now: () => time, advance: (ms: number) => (time += ms) }
}

describe('zone lookup', () => {
  it('reads a Bangkok plot against the BMA layer and names the zone', async () => {
    const { calls, fetchImpl } = server(answer(BROWN_ZONE))
    const verdict = await createZoneLookup({ fetchImpl })(bangkokPlot)
    expect(verdict).toEqual({ status: 'inside', zone: 'brown zone 9 (very high-density residential)' })
    expect(calls).toHaveLength(1)
    expect(calls[0].startsWith(ZONE_SOURCES.bkk.layer.url)).toBe(true)
  })

  it('says it has no zone data for a place with no zone source, without asking any server', async () => {
    const { calls, fetchImpl } = server(answer(BROWN_ZONE))
    const verdict = await createZoneLookup({ fetchImpl })(bangalorePlot)
    expect(verdict).toEqual({ status: 'unknown', reason: 'no-region', plan: null })
    expect(calls).toHaveLength(0)
  })

  it('does not ask any server about an outline larger than a plot', async () => {
    const { calls, fetchImpl } = server(answer(BROWN_ZONE))
    const degrees = (MAX_BBOX_SIDE_M.value * 2) / 100_000
    const citySized: LngLat[] = bangkokPlot.map(([lng, lat], index) => (index < 2 ? [lng, lat] : [lng + degrees, lat + degrees]))
    const verdict = await createZoneLookup({ fetchImpl })(citySized)
    expect(verdict).toMatchObject({ status: 'unknown', reason: 'too-large' })
    expect(calls).toHaveLength(0)
  })

  it('answers a repeated check of the same plot from memory, until the answer goes stale', async () => {
    const { calls, fetchImpl } = server(answer(BROWN_ZONE))
    const time = clock()
    const lookup = createZoneLookup({ fetchImpl, now: time.now })
    await lookup(bangkokPlot)
    await lookup(bangkokPlot)
    expect(calls).toHaveLength(1)
    time.advance(ZONE_ANSWER_MEMORY_MS.value + 1)
    await lookup(bangkokPlot)
    expect(calls).toHaveLength(2)
  })

  it('reports an unreachable server as unknown and does not ask it again for any plot until the memory expires', async () => {
    const { calls, fetchImpl } = server(down)
    const time = clock()
    const lookup = createZoneLookup({ fetchImpl, now: time.now })
    const expected = { status: 'unknown', reason: 'unreachable' }
    expect(await lookup(bangkokPlot)).toMatchObject(expected)
    expect(await lookup(otherBangkokPlot)).toMatchObject(expected)
    expect(calls).toHaveLength(1)
    time.advance(ZONE_UNREACHABLE_MEMORY_MS.value + 1)
    await lookup(otherBangkokPlot)
    expect(calls).toHaveLength(2)
  })

  it('does not remember a check the caller cancelled as an outage', async () => {
    let respond: (init?: RequestInit) => Promise<Response> = (init) =>
      new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal?.reason)))
    const lookup = createZoneLookup({ fetchImpl: ((_url: string, init?: RequestInit) => respond(init)) as typeof fetch })
    const controller = new AbortController()
    const pending = lookup(bangkokPlot, controller.signal)
    controller.abort()
    await expect(pending).rejects.toBeDefined()
    respond = answer(BLUE_ZONE)
    expect((await lookup(otherBangkokPlot)).status).toBe('outside')
  })
})
