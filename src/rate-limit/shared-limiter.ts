import type { Decision } from './limiter'

export type RemoteVerdict = { readonly success: boolean; readonly reset: number; readonly reason?: string }

export type RemoteLimit = (key: string) => Promise<RemoteVerdict>

type LocalLimiter = { readonly check: (key: string) => Decision }

const TIMED_OUT = 'timeout'

export function createSharedRateLimiter(remote: RemoteLimit, local: LocalLimiter, now: () => number = Date.now) {
  const check = async (key: string): Promise<Decision> => {
    const verdict = await remote(key).catch(() => undefined)
    if (!verdict || verdict.reason === TIMED_OUT) return local.check(key)
    if (verdict.success) return { allowed: true }
    return { allowed: false, retryAfterS: Math.max(1, Math.ceil((verdict.reset - now()) / 1000)) }
  }

  return { check }
}
