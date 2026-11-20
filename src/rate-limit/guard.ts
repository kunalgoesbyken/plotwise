import { CLIENT_ADDRESS } from './assumptions'
import { createRateLimiter, type RateLimiterOptions, type RateLimitPolicy } from './limiter'

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

export function createRateLimitGuard(policy: RateLimitPolicy, options?: RateLimiterOptions) {
  const limiter = createRateLimiter(policy, options)
  return (request: Request): Response | undefined => {
    const decision = limiter.check(clientKey(request))
    return decision.allowed ? undefined : tooManyRequests(decision.retryAfterS)
  }
}
