import { MAX_TRACKED_CLIENTS } from './assumptions'

export type RateLimitPolicy = { readonly limit: number; readonly windowMs: number }

export type Decision = { readonly allowed: true } | { readonly allowed: false; readonly retryAfterS: number }

export type RateLimiterOptions = { readonly now?: () => number; readonly maxKeys?: number }

type Window = { count: number; readonly resetAt: number }

export function createRateLimiter(
  { limit, windowMs }: RateLimitPolicy,
  { now = Date.now, maxKeys = MAX_TRACKED_CLIENTS.value }: RateLimiterOptions = {},
) {
  const windows = new Map<string, Window>()

  const makeRoom = (at: number) => {
    for (const [key, window] of windows) {
      if (window.resetAt > at && windows.size < maxKeys) return
      windows.delete(key)
    }
  }

  const check = (key: string): Decision => {
    const at = now()
    const current = windows.get(key)
    if (current && current.resetAt > at) {
      if (current.count >= limit) return { allowed: false, retryAfterS: Math.ceil((current.resetAt - at) / 1000) }
      current.count += 1
      return { allowed: true }
    }
    windows.delete(key)
    makeRoom(at)
    windows.set(key, { count: 1, resetAt: at + windowMs })
    return { allowed: true }
  }

  return { check }
}
