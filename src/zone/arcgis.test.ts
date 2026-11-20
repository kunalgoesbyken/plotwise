import { describe, expect, it } from 'bun:test'
import type { LngLat } from '@/geo/projection'
import fixture from './__fixtures__/nyc-lexington.arcgis.json'
import { RECORDED_LAYER } from './__fixtures__/recorded-layer'
import { fetchZoneFeatures, parseZoneFeatures, zoneQueryUrl, ZoneServiceUnavailableError } from './arcgis'
import { ZONE_SOURCES } from './sources'

const { bkk } = ZONE_SOURCES

const counterClockwise: LngLat[] = [
  [100.5755, 13.7789],
  [100.5759, 13.7789],
  [100.5759, 13.7792],
  [100.5755, 13.7792],
]

const respondWith = (respond: (init?: RequestInit) => Promise<Response>) => ((_url: string, init?: RequestInit) => respond(init)) as typeof fetch
const jsonResponse = (body: unknown, init?: ResponseInit) => Promise.resolve(Response.json(body, init))

describe('zoneQueryUrl', () => {
  const url = new URL(zoneQueryUrl(bkk.layer, counterClockwise))
  const param = (name: string) => url.searchParams.get(name)

  it('queries the layer asking for the zone field and its geometry in WGS 84', () => {
    expect(`${url.origin}${url.pathname}`).toBe(`${bkk.layer.url}/query`)
    expect(param('outFields')).toBe(bkk.layer.zoneField)
    expect(param('returnGeometry')).toBe('true')
    expect(param('outSR')).toBe('4326')
    expect(param('inSR')).toBe('4326')
  })

  it('sends the plot as a closed clockwise ring, however it was drawn', () => {
    const { rings } = JSON.parse(param('geometry') ?? '')
    expect(rings).toHaveLength(1)
    expect(rings[0][0]).toEqual(rings[0].at(-1))
    expect(rings[0]).toEqual([...counterClockwise].reverse().concat([counterClockwise[3]]))
  })
})

describe('parseZoneFeatures', () => {
  it('reads the district codes and rings of a recorded ArcGIS response', () => {
    const features = parseZoneFeatures(RECORDED_LAYER, fixture)
    expect(features.map(({ code }) => code)).toEqual(['R8B', 'C1-8X', 'C1-9', 'R8B'])
    expect(features[2].rings[0][0]).toEqual([-73.960399, 40.769191])
  })

  it('drops features with no zone code or no geometry', () => {
    const body = {
      features: [
        { attributes: { ZONEDIST: null }, geometry: { rings: [[[0, 0], [1, 0], [1, 1]]] } },
        { attributes: { ZONEDIST: 'R7A' }, geometry: null },
        { attributes: { ZONEDIST: 'R6' }, geometry: { rings: [[[0, 0], [1, 0], [1, 1]]] } },
      ],
    }
    expect(parseZoneFeatures(RECORDED_LAYER, body).map(({ code }) => code)).toEqual(['R6'])
  })

  it('reads an empty answer as no features', () => {
    expect(parseZoneFeatures(RECORDED_LAYER, { features: [] })).toEqual([])
  })

  it('surfaces the message of an ArcGIS error body', () => {
    expect(() => parseZoneFeatures(RECORDED_LAYER, { error: { code: 400, message: 'Invalid query' } })).toThrow('Invalid query')
  })

  it('refuses a body that is not a feature list', () => {
    expect(() => parseZoneFeatures(RECORDED_LAYER, { features: 'none' })).toThrow('unexpected response shape')
    expect(() => parseZoneFeatures(RECORDED_LAYER, 'html')).toThrow('unexpected response shape')
  })
})

describe('fetchZoneFeatures', () => {
  it('returns the parsed features of a good answer', async () => {
    const features = await fetchZoneFeatures(RECORDED_LAYER, counterClockwise, { fetchImpl: respondWith(() => jsonResponse(fixture)) })
    expect(features).toHaveLength(4)
  })

  it('reports a failing server as unavailable', async () => {
    const failing = respondWith(() => jsonResponse({}, { status: 503 }))
    await expect(fetchZoneFeatures(RECORDED_LAYER, counterClockwise, { fetchImpl: failing })).rejects.toBeInstanceOf(ZoneServiceUnavailableError)
  })

  it('gives up on a server that does not answer within the timeout', async () => {
    const silent = respondWith(
      (init) => new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))),
    )
    const started = performance.now()
    await expect(fetchZoneFeatures(RECORDED_LAYER, counterClockwise, { fetchImpl: silent, timeoutMs: 30 })).rejects.toBeInstanceOf(
      ZoneServiceUnavailableError,
    )
    expect(performance.now() - started).toBeLessThan(1_000)
  })
})
