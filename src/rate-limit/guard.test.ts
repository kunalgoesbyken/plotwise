import { describe, expect, it } from 'bun:test'
import { CLIENT_ADDRESS } from './assumptions'
import { clientKey, createRateLimitGuard } from './guard'

const request = (headers: Record<string, string> = {}) => new Request('http://localhost/api/site', { headers })

describe('clientKey', () => {
  it('uses the first address the platform forwarded', () => {
    expect(clientKey(request({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))).toBe('203.0.113.7')
  })

  it('falls back to the real-ip header and then to one shared bucket', () => {
    expect(clientKey(request({ 'x-real-ip': '203.0.113.9' }))).toBe('203.0.113.9')
    expect(clientKey(request())).toBe(CLIENT_ADDRESS.value.fallback)
    expect(clientKey(request({ 'x-forwarded-for': ' ' }))).toBe(CLIENT_ADDRESS.value.fallback)
  })
})

describe('createRateLimitGuard', () => {
  it('lets requests through up to the limit, then answers 429 with Retry-After and no caching', async () => {
    const guard = createRateLimitGuard({ limit: 2, windowMs: 30_000 }, { now: () => 0 })
    const client = { 'x-forwarded-for': '203.0.113.7' }
    expect(guard(request(client))).toBeUndefined()
    expect(guard(request(client))).toBeUndefined()
    const refused = guard(request(client))
    expect(refused?.status).toBe(429)
    expect(refused?.headers.get('retry-after')).toBe('30')
    expect(refused?.headers.get('cache-control')).toBe('no-store')
    expect(await refused?.json()).toEqual({ error: 'Too many requests; try again shortly' })
  })

  it('does not refuse a different client', () => {
    const guard = createRateLimitGuard({ limit: 1, windowMs: 30_000 }, { now: () => 0 })
    guard(request({ 'x-forwarded-for': '203.0.113.7' }))
    expect(guard(request({ 'x-forwarded-for': '203.0.113.8' }))).toBeUndefined()
  })
})
