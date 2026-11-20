import { describe, expect, it } from 'bun:test'
import { PlaceSearchError, searchPlaces } from './client'
import type { Place } from './schema'

const places: Place[] = [{ id: 'N5391625873', label: 'Asok, Bangkok', lngLat: [100.56, 13.737], kind: 'house' }]

function fetchReturning(response: Response): { fetchImpl: typeof fetch; calls: { url: string; init?: RequestInit }[] } {
  const calls: { url: string; init?: RequestInit }[] = []
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init })
    return response
  }) as typeof fetch
  return { fetchImpl, calls }
}

describe('searchPlaces', () => {
  it('sends the normalised query so the same search shares one cache entry', async () => {
    const { fetchImpl, calls } = fetchReturning(Response.json(places))
    await searchPlaces('  ถนน   รัชดาภิเษก ', 'bkk', { fetchImpl })
    expect(new URL(calls[0].url, 'http://localhost').searchParams.get('q')).toBe('ถนน รัชดาภิเษก')
    expect(calls[0].url).toStartWith('/api/geocode?q=')
  })

  it('returns the validated places and passes the abort signal', async () => {
    const { fetchImpl, calls } = fetchReturning(Response.json(places))
    const controller = new AbortController()
    expect(await searchPlaces('Asok', 'bkk', { fetchImpl, signal: controller.signal })).toEqual(places)
    expect(calls[0].init?.signal).toBe(controller.signal)
  })

  it('throws the server message and status on an error response', async () => {
    const { fetchImpl } = fetchReturning(Response.json({ error: 'q must be at least 2 characters' }, { status: 400 }))
    const failure = await searchPlaces('a', 'bkk', { fetchImpl }).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(PlaceSearchError)
    expect((failure as PlaceSearchError).message).toBe('q must be at least 2 characters')
    expect((failure as PlaceSearchError).status).toBe(400)
  })

  it('falls back to the status when the error body is not ours', async () => {
    const { fetchImpl } = fetchReturning(new Response('<html>bad gateway</html>', { status: 502 }))
    const failure = await searchPlaces('Asok', 'bkk', { fetchImpl }).catch((error: unknown) => error)
    expect((failure as PlaceSearchError).message).toBe('Place search failed with HTTP 502')
  })

  it('rejects a response that breaks the contract', async () => {
    const { fetchImpl } = fetchReturning(Response.json([{ ...places[0], lngLat: [500, 13] }]))
    await expect(searchPlaces('Asok', 'bkk', { fetchImpl })).rejects.toThrow()
  })
})
