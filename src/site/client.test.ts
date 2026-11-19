import { describe, expect, it } from 'bun:test'
import { OSM_ATTRIBUTION } from './assumptions'
import { SiteRequestError, fetchSite } from './client'
import type { Site } from './schema'

const site: Site = {
  bbox: [100.566, 13.762, 100.572, 13.768],
  buildings: [
    {
      id: 'way/1',
      outer: [
        [100.5, 13.7],
        [100.501, 13.7],
        [100.501, 13.701],
      ],
      holes: [],
      heightM: 12,
      heightSource: 'levels',
      minHeightM: 0,
    },
  ],
  roads: [
    {
      id: 'way/2',
      line: [
        [100.5, 13.7],
        [100.501, 13.7],
      ],
      highway: 'residential',
      widthM: 5,
      widthSource: 'class',
      grade: 'ground',
    },
  ],
  attribution: OSM_ATTRIBUTION,
}

function fetchReturning(response: Response): { fetchImpl: typeof fetch; urls: string[] } {
  const urls: string[] = []
  const fetchImpl = (async (input: string | URL | Request) => {
    urls.push(String(input))
    return response
  }) as typeof fetch
  return { fetchImpl, urls }
}

describe('fetchSite', () => {
  it('requests the snapped bbox so nearby calls share a cache entry', async () => {
    const { fetchImpl, urls } = fetchReturning(Response.json(site))
    await fetchSite([100.5671, 13.7632, 100.5709, 13.7668], { fetchImpl })
    expect(urls).toEqual(['/api/site?bbox=100.566,13.762,100.572,13.768'])
  })

  it('returns the validated site', async () => {
    const { fetchImpl } = fetchReturning(Response.json(site))
    expect(await fetchSite([100.5671, 13.7632, 100.5709, 13.7668], { fetchImpl })).toEqual(site)
  })

  it('throws the server message and status on an error response', async () => {
    const { fetchImpl } = fetchReturning(Response.json({ error: 'bbox must lie inside Thailand' }, { status: 400 }))
    const failure = await fetchSite([100.5671, 13.7632, 100.5709, 13.7668], { fetchImpl }).catch((e: unknown) => e)
    expect(failure).toBeInstanceOf(SiteRequestError)
    expect((failure as SiteRequestError).message).toBe('bbox must lie inside Thailand')
    expect((failure as SiteRequestError).status).toBe(400)
  })

  it('falls back to the status when the error body is not ours', async () => {
    const { fetchImpl } = fetchReturning(new Response('<html>bad gateway</html>', { status: 502 }))
    const failure = await fetchSite([100.5671, 13.7632, 100.5709, 13.7668], { fetchImpl }).catch((e: unknown) => e)
    expect((failure as SiteRequestError).message).toBe('Site request failed with HTTP 502')
  })

  it('rejects a response that breaks the contract', async () => {
    const broken = { ...site, buildings: [{ ...site.buildings[0], heightM: -1 }] }
    const { fetchImpl } = fetchReturning(Response.json(broken))
    await expect(fetchSite([100.5671, 13.7632, 100.5709, 13.7668], { fetchImpl })).rejects.toThrow()
  })

  it('passes the abort signal to fetch', async () => {
    let seen: RequestInit | undefined
    const fetchImpl = (async (_input: string | URL | Request, init?: RequestInit) => {
      seen = init
      return Response.json(site)
    }) as typeof fetch
    const controller = new AbortController()
    await fetchSite([100.5671, 13.7632, 100.5709, 13.7668], { fetchImpl, signal: controller.signal })
    expect(seen?.signal).toBe(controller.signal)
  })
})
