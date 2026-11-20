import { describe, expect, it } from 'bun:test'
import type { LngLat } from '@/geo/projection'
import fixture from './__fixtures__/nyc-lexington.arcgis.json'
import { ZONE_ANSWER_MEMORY_MS, ZONE_UNREACHABLE_MEMORY_MS } from './assumptions'
import { createZoneLookup } from './lookup'

const nycPlot: LngLat[] = [
  [-73.96355, 40.76575],
  [-73.96345, 40.76575],
  [-73.96345, 40.76585],
  [-73.96355, 40.76585],
]

const otherNycPlot: LngLat[] = nycPlot.map(([lng, lat]) => [lng, lat + 0.0001])

const bangkokPlot: LngLat[] = [
  [100.5755, 13.7789],
  [100.5759, 13.7789],
  [100.5759, 13.7792],
  [100.5755, 13.7792],
]

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

const answer = () => Promise.resolve(Response.json(fixture))
const down = () => Promise.resolve(Response.json({}, { status: 503 }))

function clock(start = 1_000) {
  let time = start
  return { now: () => time, advance: (ms: number) => (time += ms) }
}

describe('zone lookup', () => {
  it('reads a New York plot against the New York layer and names the district', async () => {
    const { calls, fetchImpl } = server(answer)
    const verdict = await createZoneLookup({ fetchImpl })(nycPlot)
    expect(verdict.status).toBe('unsupported')
    expect(verdict).toMatchObject({ parts: [{ zone: 'C1-9' }] })
    expect(calls).toHaveLength(1)
    expect(calls[0].startsWith('https://services5.arcgis.com/')).toBe(true)
  })

  it('says it has no zone data for a place with no zone source, without asking any server', async () => {
    const { calls, fetchImpl } = server(answer)
    const verdict = await createZoneLookup({ fetchImpl })(bangalorePlot)
    expect(verdict).toEqual({ status: 'unknown', reason: 'no-region', plan: null })
    expect(calls).toHaveLength(0)
  })

  it('answers a repeated check of the same plot from memory, until the answer goes stale', async () => {
    const { calls, fetchImpl } = server(answer)
    const time = clock()
    const lookup = createZoneLookup({ fetchImpl, now: time.now })
    await lookup(nycPlot)
    await lookup(nycPlot)
    expect(calls).toHaveLength(1)
    time.advance(ZONE_ANSWER_MEMORY_MS.value + 1)
    await lookup(nycPlot)
    expect(calls).toHaveLength(2)
  })

  it('reports an unreachable server as unknown and does not ask it again for any plot until the memory expires', async () => {
    const { calls, fetchImpl } = server(down)
    const time = clock()
    const lookup = createZoneLookup({ fetchImpl, now: time.now })
    const expected = { status: 'unknown', reason: 'unreachable' }
    expect(await lookup(nycPlot)).toMatchObject(expected)
    expect(await lookup(otherNycPlot)).toMatchObject(expected)
    expect(calls).toHaveLength(1)
    time.advance(ZONE_UNREACHABLE_MEMORY_MS.value + 1)
    await lookup(otherNycPlot)
    expect(calls).toHaveLength(2)
  })

  it('keeps one region being down from blocking another', async () => {
    const { fetchImpl } = server(down)
    const lookup = createZoneLookup({ fetchImpl })
    await lookup(nycPlot)
    const { fetchImpl: bangkokServer } = server(answer)
    const bangkok = createZoneLookup({ fetchImpl: bangkokServer })
    expect(await bangkok(bangkokPlot)).toMatchObject({ status: 'unknown', reason: 'no-zone' })
  })

  it('does not remember a check the caller cancelled as an outage', async () => {
    let respond: (init?: RequestInit) => Promise<Response> = (init) =>
      new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal?.reason)))
    const lookup = createZoneLookup({ fetchImpl: ((_url: string, init?: RequestInit) => respond(init)) as typeof fetch })
    const controller = new AbortController()
    const pending = lookup(nycPlot, controller.signal)
    controller.abort()
    await expect(pending).rejects.toBeDefined()
    respond = answer
    expect((await lookup(otherNycPlot)).status).toBe('unsupported')
  })
})
