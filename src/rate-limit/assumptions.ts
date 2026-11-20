import type { Assumption } from '@/site/assumptions'
import type { RateLimitPolicy } from './limiter'

const MINUTE_MS = 60_000

export type RateLimitedRoute = 'geocode' | 'site'

export const ROUTE_RATE_LIMITS: Assumption<Readonly<Record<RateLimitedRoute, RateLimitPolicy>>> = {
  value: {
    geocode: { limit: 60, windowMs: MINUTE_MS },
    site: { limit: 20, windowMs: MINUTE_MS },
  },
  source:
    'assumption: per client IP, and per server instance when no shared store is configured, several times what one person causes. Search waits 250 ms after typing, so one address with pauses is about 10 searches and 60 a minute is several addresses. Site data is one request per map cell and the public Overpass servers are the scarcest upstream, so it is the lowest. Answers served from the CDN cache never reach the route and are not counted',
}

export const MAX_TRACKED_CLIENTS: Assumption<number> = {
  value: 10_000,
  source: 'assumption: about 100 bytes per tracked client keeps a busy instance near 1 MB; the oldest window is dropped first when the cap is reached',
}

export const CLIENT_ADDRESS: Assumption<{ readonly headers: readonly string[]; readonly fallback: string }> = {
  value: { headers: ['x-forwarded-for', 'x-real-ip'], fallback: 'unknown' },
  source:
    'assumption: Vercel overwrites x-forwarded-for with the address of the client and does not forward external values (vercel.com/docs/headers/request-headers), so the first entry is trusted there. A request with neither header (local runs, tests) shares one bucket instead of bypassing the limit',
}

export const SHARED_STORE_ENV: Assumption<{ readonly url: readonly string[]; readonly token: readonly string[] }> = {
  value: {
    url: ['UPSTASH_REDIS_REST_URL', 'KV_REST_API_URL'],
    token: ['UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_TOKEN'],
  },
  source:
    'Upstash SDK: Redis.fromEnv reads UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN and falls back to KV_REST_API_URL and KV_REST_API_TOKEN, the names the Vercel integration injects (node_modules/@upstash/redis/nodejs.d.ts; vercel.com/docs/redis)',
}

export const SHARED_STORE_TIMEOUT_MS: Assumption<number> = {
  value: 1_000,
  source:
    'assumption: a regional Upstash REST call answers in tens of milliseconds, and a check that has not answered in a second costs the visitor more than the per-instance limit costs the upstreams, so that request is counted in memory instead',
}

export const SHARED_STORE_KEY_PREFIX: Assumption<string> = {
  value: 'plotwise:rate-limit',
  source: 'assumption: namespaces the keys so the same free database can serve other uses; the route name is appended so routes never share a counter',
}
