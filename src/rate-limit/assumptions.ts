import type { Assumption } from '@/site/assumptions'
import type { RateLimitPolicy } from './limiter'

const MINUTE_MS = 60_000

export const ROUTE_RATE_LIMITS: Assumption<Readonly<Record<'geocode' | 'site' | 'zone', RateLimitPolicy>>> = {
  value: {
    geocode: { limit: 60, windowMs: MINUTE_MS },
    site: { limit: 20, windowMs: MINUTE_MS },
    zone: { limit: 30, windowMs: MINUTE_MS },
  },
  source:
    'assumption: per client IP and server instance, several times what one person causes. Search waits 250 ms after typing, so one address with pauses is about 10 searches and 60 a minute is several addresses. The zone check waits 400 ms after a dragged corner settles, and 30 a minute is a corner moved every two seconds. Site data is one request per map cell and the public Overpass servers are the scarcest upstream, so it is the lowest. Answers served from the CDN cache never reach the route and are not counted',
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
