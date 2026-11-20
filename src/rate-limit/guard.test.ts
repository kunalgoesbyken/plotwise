import { describe, expect, it } from 'bun:test'
import { CLIENT_ADDRESS } from './assumptions'
import { clientKey, createRateLimitGuard } from './guard'
import type { RemoteLimit } from './shared-limiter'

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

const policy = { limit: 2, windowMs: 30_000 }
const client = { 'x-forwarded-for': '203.0.113.7' }
const sharedEnv = { UPSTASH_REDIS_REST_URL: 'https://eu-1.upstash.io', UPSTASH_REDIS_REST_TOKEN: 'secret' }

type Connection = { credentials: unknown; route: string; policy: unknown }

function fakeStore(remote: RemoteLimit) {
  const connections: Connection[] = []
  return {
    connections,
    connect: (credentials: unknown, route: string, rules: unknown) => {
      connections.push({ credentials, route, policy: rules })
      return remote
    },
  }
}

const countingStore: () => RemoteLimit = () => {
  const counts = new Map<string, number>()
  return async (key) => {
    const count = (counts.get(key) ?? 0) + 1
    counts.set(key, count)
    return { success: count <= policy.limit, reset: 30_000 }
  }
}

const unreachable: RemoteLimit = async () => {
  throw new Error('fetch failed')
}

describe('createRateLimitGuard', () => {
  it('lets requests through up to the limit, then answers 429 with Retry-After and no caching', async () => {
    const guard = createRateLimitGuard('site', policy, { now: () => 0, env: {} })
    expect(await guard(request(client))).toBeUndefined()
    expect(await guard(request(client))).toBeUndefined()
    const refused = await guard(request(client))
    expect(refused?.status).toBe(429)
    expect(refused?.headers.get('retry-after')).toBe('30')
    expect(refused?.headers.get('cache-control')).toBe('no-store')
    expect(await refused?.json()).toEqual({ error: 'Too many requests; try again shortly' })
  })

  it('does not refuse a different client', async () => {
    const guard = createRateLimitGuard('site', { limit: 1, windowMs: 30_000 }, { now: () => 0, env: {} })
    await guard(request(client))
    expect(await guard(request({ 'x-forwarded-for': '203.0.113.8' }))).toBeUndefined()
  })

  it('counts in memory and never connects while no shared store is configured', async () => {
    const store = fakeStore(countingStore())
    const guard = createRateLimitGuard('site', policy, { now: () => 0, env: {}, connect: store.connect })
    for (let i = 0; i < policy.limit; i++) await guard(request(client))
    expect((await guard(request(client)))?.status).toBe(429)
    expect(store.connections).toEqual([])
  })

  it('counts in the shared store, connected once per route with its own name and limits, when its variables are set', async () => {
    const store = fakeStore(countingStore())
    const guard = createRateLimitGuard('geocode', policy, { now: () => 0, env: sharedEnv, connect: store.connect })
    for (let i = 0; i < policy.limit; i++) expect(await guard(request(client))).toBeUndefined()
    expect((await guard(request(client)))?.status).toBe(429)
    expect(store.connections).toEqual([
      { credentials: { url: sharedEnv.UPSTASH_REDIS_REST_URL, token: sharedEnv.UPSTASH_REDIS_REST_TOKEN }, route: 'geocode', policy },
    ])
  })

  it('gives the same sequence of answers from the shared store as from memory', async () => {
    const memory = createRateLimitGuard('site', policy, { now: () => 0, env: {} })
    const shared = createRateLimitGuard('site', policy, { now: () => 0, env: sharedEnv, connect: fakeStore(countingStore()).connect })
    const statuses = async (guard: typeof memory) => {
      const results: (number | undefined)[] = []
      for (let i = 0; i < policy.limit + 2; i++) results.push((await guard(request(client)))?.status)
      return results
    }
    expect(await statuses(shared)).toEqual(await statuses(memory))
  })

  it('keeps answering from memory while the shared store is down', async () => {
    const guard = createRateLimitGuard('site', policy, { now: () => 0, env: sharedEnv, connect: fakeStore(unreachable).connect })
    for (let i = 0; i < policy.limit; i++) expect(await guard(request(client))).toBeUndefined()
    expect((await guard(request(client)))?.status).toBe(429)
  })
})
