import { describe, expect, it } from 'bun:test'
import { THAILAND_BBOX } from '@/site/assumptions'
import { USER_AGENT } from '@/site/user-agent'
import english from './__fixtures__/asok.photon-en.json'
import { SEARCH_BIAS_LNGLAT, SEARCH_RESULT_LIMIT } from './assumptions'
import { PlaceSearchUnavailableError, fetchPlaces } from './photon'
import { PlacesSchema } from './schema'

type Handler = (url: URL, init: RequestInit) => Response | Promise<Response>

function fakePhoton(handler: Handler): { fetchImpl: typeof fetch; calls: { url: URL; init: RequestInit }[] } {
  const calls: { url: URL; init: RequestInit }[] = []
  const fetchImpl = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input))
    calls.push({ url, init })
    return handler(url, init)
  }) as typeof fetch
  return { fetchImpl, calls }
}

const recorded = () => Response.json(english)

describe('fetchPlaces', () => {
  it('asks Photon once, in English, biased to Bangkok and limited to Thailand', async () => {
    const { fetchImpl, calls } = fakePhoton(recorded)
    await fetchPlaces('asok', { fetchImpl })
    expect(calls.map(({ url }) => url.searchParams.get('lang'))).toEqual(['en'])
    const { url, init } = calls[0]
    expect(url.origin + url.pathname).toBe('https://photon.komoot.io/api')
    expect(url.searchParams.get('q')).toBe('asok')
    expect(url.searchParams.get('lon')).toBe(String(SEARCH_BIAS_LNGLAT.value[0]))
    expect(url.searchParams.get('lat')).toBe(String(SEARCH_BIAS_LNGLAT.value[1]))
    expect(url.searchParams.get('bbox')).toBe(THAILAND_BBOX.value.join(','))
    expect(url.searchParams.get('limit')).toBe(String(SEARCH_RESULT_LIMIT.value))
    expect(new Headers(init.headers).get('user-agent')).toBe(USER_AGENT)
  })

  it('labels each place in English', async () => {
    const places = await fetchPlaces('asok', { fetchImpl: fakePhoton(recorded).fetchImpl })
    expect(PlacesSchema.safeParse(places).success).toBe(true)
    expect(places[0]).toEqual({
      id: 'N5391625873',
      label: 'Asok, Sukhumvit Road, Khlong Toei, Bangkok',
      lngLat: [100.5603571, 13.7370432],
      kind: 'house',
    })
  })

  it('leaves out places with nothing to call them', async () => {
    const feature = (properties: Record<string, unknown>) => ({
      type: 'Feature',
      properties: { osm_type: 'W', osm_id: 1, ...properties },
      geometry: { type: 'Point', coordinates: [100.5, 13.7] },
    })
    const body = { type: 'FeatureCollection', features: [feature({ name: 'Terminal 21', type: 'mystery' }), { ...feature({}), properties: { osm_type: 'W', osm_id: 2 } }] }
    const places = await fetchPlaces('terminal 21', { fetchImpl: fakePhoton(() => Response.json(body)).fetchImpl })
    expect(places).toEqual([{ id: 'W1', label: 'Terminal 21', lngLat: [100.5, 13.7], kind: 'other' }])
  })

  it('reports Photon as unavailable on an HTTP error, a timeout or an unexpected answer', async () => {
    const failures: Handler[] = [
      () => new Response('slow down', { status: 429 }),
      () => Response.json({ nope: true }),
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(init.signal?.reason))
        }),
    ]
    for (const handler of failures) {
      const failure = await fetchPlaces('asok', { fetchImpl: fakePhoton(handler).fetchImpl, timeoutMs: 20 }).catch((error: unknown) => error)
      expect(failure).toBeInstanceOf(PlaceSearchUnavailableError)
    }
  })
})
