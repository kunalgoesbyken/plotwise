import { describe, expect, it } from 'bun:test'
import { REGION } from '@/region/regions'
import { HIGHWAY_CLASSES } from './assumptions'
import type { Bbox } from './bbox'
import { OverpassUnavailableError, fetchOverpass, overpassQuery } from './overpass'
import { USER_AGENT } from './user-agent'

const bbox: Bbox = [100.566, 13.762, 100.572, 13.768]
const stationBbox: Bbox = [100.56, 13.756, 100.578, 13.774]
const query = overpassQuery(bbox, stationBbox, 20)
const instances = ['https://a.test/api', 'https://b.test/api', 'https://c.test/api']
const okBody = { elements: [{ type: 'way', id: 1, tags: { building: 'yes' }, geometry: [] }] }

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>

function fakeFetch(handlers: Record<string, Handler>): { fetchImpl: typeof fetch; calls: string[] } {
  const calls: string[] = []
  const fetchImpl = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input)
    calls.push(url)
    return handlers[url](url, init)
  }) as typeof fetch
  return { fetchImpl, calls }
}

const ok = () => Response.json(okBody)
const status = (code: number) => () => new Response('busy', { status: code })

describe('overpassQuery', () => {
  it('uses south,west,north,east order', () => {
    expect(query).toContain('(13.762,100.566,13.768,100.572)')
  })

  it('asks for building ways, multipolygon relations and building parts', () => {
    expect(query).toContain('way["building"]["building"!="no"]')
    expect(query).toContain('relation["building"]["type"="multipolygon"]')
    expect(query).toContain('way["building:part"]')
  })

  it('asks only for the road classes the parser knows', () => {
    expect(query).toContain(`way["highway"~"^(${HIGHWAY_CLASSES.join('|')})$"]`)
  })

  it('asks for mass-transit platforms and station nodes in the wider station box', () => {
    const stationArea = '(13.756,100.56,13.774,100.578)'
    const modes = REGION.transit.platformModes.value.join('|')
    expect(query).toContain(`nw["railway"="platform"]${stationArea};`)
    expect(query).toContain(`nw["public_transport"="platform"][~"^(${modes})$"~"^yes$"]${stationArea};`)
    expect(query).toContain(`node["railway"="station"]["station"~"^(${REGION.transit.stationNodeTypes.value.join('|')})$"]${stationArea};`)
  })

  it('returns tags and geometry as JSON with a server timeout', () => {
    expect(query).toStartWith('[out:json][timeout:20];')
    expect(query).toEndWith('out geom;')
  })
})

describe('fetchOverpass', () => {
  it('posts the query with a descriptive User-Agent and returns the parsed response', async () => {
    let seen: RequestInit = {}
    const { fetchImpl } = fakeFetch({
      'https://a.test/api': (_url, init) => {
        seen = init
        return ok()
      },
    })
    const response = await fetchOverpass(query, { instances, fetchImpl })
    expect(response.elements).toHaveLength(1)
    expect(seen.method).toBe('POST')
    expect(new Headers(seen.headers).get('user-agent')).toBe(USER_AGENT)
    expect(String(seen.body)).toContain(encodeURIComponent('way["building"]'))
  })

  it('fails over to the next instance on a 429 and then a 504', async () => {
    const { fetchImpl, calls } = fakeFetch({
      'https://a.test/api': status(429),
      'https://b.test/api': status(504),
      'https://c.test/api': ok,
    })
    await fetchOverpass(query, { instances, fetchImpl })
    expect(calls).toEqual(instances)
  })

  it('fails over when an instance throws or times out', async () => {
    const { fetchImpl, calls } = fakeFetch({
      'https://a.test/api': () => {
        throw new TypeError('fetch failed')
      },
      'https://b.test/api': (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(init.signal?.reason))
        }),
      'https://c.test/api': ok,
    })
    await fetchOverpass(query, { instances, fetchImpl, timeoutMs: 20 })
    expect(calls).toEqual(instances)
  })

  it('fails over when an instance answers 200 with a runtime error remark', async () => {
    const { fetchImpl, calls } = fakeFetch({
      'https://a.test/api': () => Response.json({ remark: 'runtime error: Query timed out in "query"', elements: [] }),
      'https://b.test/api': ok,
    })
    await fetchOverpass(query, { instances, fetchImpl })
    expect(calls).toEqual(instances.slice(0, 2))
  })

  it('fails over when an instance answers with HTML or an unexpected shape', async () => {
    const { fetchImpl, calls } = fakeFetch({
      'https://a.test/api': () => new Response('<html>rate limited</html>', { status: 200 }),
      'https://b.test/api': () => Response.json({ nope: true }),
      'https://c.test/api': ok,
    })
    await fetchOverpass(query, { instances, fetchImpl })
    expect(calls).toEqual(instances)
  })

  it('reports every attempt when all instances fail', async () => {
    const { fetchImpl } = fakeFetch({
      'https://a.test/api': status(429),
      'https://b.test/api': status(500),
      'https://c.test/api': status(504),
    })
    const failure = await fetchOverpass(query, { instances, fetchImpl }).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(OverpassUnavailableError)
    expect((failure as OverpassUnavailableError).attempts).toHaveLength(3)
    expect((failure as OverpassUnavailableError).message).toContain('https://c.test/api')
  })
})
