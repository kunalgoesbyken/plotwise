import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { NextRequest } from 'next/server'
import type { Bbox } from '@/site/bbox'
import { SITE_CACHE_S } from '@/site/assumptions'
import { SiteErrorSchema } from '@/site/schema'

const requested: Bbox[] = []
let failure: Error | undefined

mock.module('@/site/load-site', () => ({
  loadSite: async (bbox: Bbox) => {
    requested.push(bbox)
    if (failure) throw failure
    return { bbox, buildings: [], roads: [], attribution: 'test' }
  },
}))

const { GET } = await import('./route')

const call = (query: string) => GET(new NextRequest(`http://localhost/api/site${query}`))

beforeEach(() => {
  requested.length = 0
  failure = undefined
})

describe('GET /api/site', () => {
  it('serves the snapped bbox with CDN cache headers', async () => {
    const response = await call('?bbox=100.5671,13.7632,100.5709,13.7668')
    expect(response.status).toBe(200)
    expect(requested).toEqual([[100.566, 13.762, 100.572, 13.768]])
    const { browser, cdn, staleWhileRevalidate } = SITE_CACHE_S.value
    expect(response.headers.get('cache-control')).toBe(
      `public, max-age=${browser}, s-maxage=${cdn}, stale-while-revalidate=${staleWhileRevalidate}`,
    )
    expect((await response.json()).bbox).toEqual([100.566, 13.762, 100.572, 13.768])
  })

  it.each([
    ['', 'bbox is required'],
    ['?bbox=1,2,3', 'four numbers'],
    ['?bbox=77.58,12.97,77.59,12.98', 'Thailand'],
    ['?bbox=100.5,13.7,100.6,13.8', 'too large'],
  ])('rejects %p with a 400 and a clear message', async (query, expected) => {
    const response = await call(query)
    expect(response.status).toBe(400)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(SiteErrorSchema.parse(await response.json()).error).toContain(expected)
    expect(requested).toEqual([])
  })

  it('answers 502 when every Overpass instance fails', async () => {
    failure = new Error('Overpass is unavailable: a: HTTP 502')
    const response = await call('?bbox=100.5671,13.7632,100.5709,13.7668')
    expect(response.status).toBe(502)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(SiteErrorSchema.parse(await response.json()).error).toContain('Overpass is unavailable')
  })
})
