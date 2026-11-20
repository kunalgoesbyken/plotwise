import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { type RateLimitedRoute, SHARED_STORE_KEY_PREFIX, SHARED_STORE_TIMEOUT_MS } from './assumptions'
import type { RateLimitPolicy } from './limiter'
import type { SharedStoreCredentials } from './shared-credentials'
import type { RemoteLimit } from './shared-limiter'

export function connectUpstash(credentials: SharedStoreCredentials, route: RateLimitedRoute, { limit, windowMs }: RateLimitPolicy): RemoteLimit {
  const ratelimit = new Ratelimit({
    redis: new Redis({ ...credentials, retry: false }),
    limiter: Ratelimit.fixedWindow(limit, `${windowMs} ms`),
    prefix: `${SHARED_STORE_KEY_PREFIX.value}:${route}`,
    timeout: SHARED_STORE_TIMEOUT_MS.value,
  })
  return (key) => ratelimit.limit(key)
}
