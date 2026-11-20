import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { NextRequest } from 'next/server'
import { PLACES_CACHE_S } from '@/geocode/assumptions'
import { MAX_QUERY_LENGTH, PlaceErrorSchema, PlacesSchema, type Place } from '@/geocode/schema'

const asok: Place = { id: 'N5391625873', label: 'Asok, Bangkok', lngLat: [100.56, 13.737], kind: 'house' }
const requested: string[] = []
let failure: Error | undefined

mock.module('@/geocode/load-places', () => ({
  loadPlaces: async (query: string) => {
    requested.push(query)
    if (failure) throw failure
    return [asok]
  },
}))

const { GET } = await import('./route')

const call = (query: string) => GET(new NextRequest(`http://localhost/api/geocode${query}`))

beforeEach(() => {
  requested.length = 0
  failure = undefined
})

describe('GET /api/geocode', () => {
  it('answers a normalised query with validated places and CDN cache headers', async () => {
    const response = await call(`?q=${encodeURIComponent('  Asok  ')}`)
    expect(response.status).toBe(200)
    expect(requested).toEqual(['asok'])
    const { browser, cdn, staleWhileRevalidate } = PLACES_CACHE_S.value
    expect(response.headers.get('cache-control')).toBe(
      `public, max-age=${browser}, s-maxage=${cdn}, stale-while-revalidate=${staleWhileRevalidate}`,
    )
    expect(PlacesSchema.parse(await response.json())).toEqual([asok])
  })

  it('accepts Thai text', async () => {
    const response = await call(`?q=${encodeURIComponent('ถนนรัชดาภิเษก')}`)
    expect(response.status).toBe(200)
    expect(requested).toEqual(['ถนนรัชดาภิเษก'])
  })

  it.each([
    ['', 'q is required'],
    ['?q=a', 'at least'],
    [`?q=${'x'.repeat(MAX_QUERY_LENGTH + 1)}`, 'at most'],
    ['?q=%3F%3F%3F', 'letter or digit'],
  ])('rejects %p with a 400 and a clear message', async (query, expected) => {
    const response = await call(query)
    expect(response.status).toBe(400)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(PlaceErrorSchema.parse(await response.json()).error).toContain(expected)
    expect(requested).toEqual([])
  })

  it('answers 502 without upstream details when Photon fails', async () => {
    failure = new Error('Place search is unavailable: HTTP 429')
    const response = await call('?q=asok')
    expect(response.status).toBe(502)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(PlaceErrorSchema.parse(await response.json()).error).toBe('Place search is unavailable right now; try again shortly')
  })
})
