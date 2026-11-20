import { CLIENT_ADDRESS, type RateLimitedRoute } from './assumptions'
import { createRateLimiter, type RateLimiterOptions, type RateLimitPolicy } from './limiter'
import { type Environment, sharedStoreCredentials, type SharedStoreCredentials } from './shared-credentials'
import { createSharedRateLimiter, type RemoteLimit } from './shared-limiter'
import { connectUpstash } from './upstash'

export function clientKey(request: Request): string {
  const { headers, fallback } = CLIENT_ADDRESS.value
  for (const header of headers) {
    const first = request.headers.get(header)?.split(',')[0]?.trim()
    if (first) return first
  }
  return fallback
}

function tooManyRequests(retryAfterS: number): Response {
  return Response.json(
    { error: 'Too many requests; try again shortly' },
    { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': String(retryAfterS) } },
  )
}

export type GuardOptions = RateLimiterOptions & {
  readonly env?: Environment
  readonly connect?: (credentials: SharedStoreCredentials, route: RateLimitedRoute, policy: RateLimitPolicy) => RemoteLimit
}

function createLimiter(route: RateLimitedRoute, policy: RateLimitPolicy, { env = process.env, connect = connectUpstash, ...options }: GuardOptions) {
  const local = createRateLimiter(policy, options)
  const credentials = sharedStoreCredentials(env)
  return credentials ? createSharedRateLimiter(connect(credentials, route, policy), local, options.now) : local
}

export function createRateLimitGuard(route: RateLimitedRoute, policy: RateLimitPolicy, options: GuardOptions = {}) {
  const limiter = createLimiter(route, policy, options)
  return async (request: Request): Promise<Response | undefined> => {
    const decision = await limiter.check(clientKey(request))
    return decision.allowed ? undefined : tooManyRequests(decision.retryAfterS)
  }
}
