import { describe, expect, it } from 'bun:test'
import fc from 'fast-check'
import { createRateLimiter } from './limiter'
import { createSharedRateLimiter, type RemoteLimit } from './shared-limiter'

const policy = { limit: 3, windowMs: 10_000 }

function clock(start = 1_000_000) {
  let time = start
  return {
    now: () => time,
    advance: (ms: number) => {
      time += ms
    },
  }
}

function fixedWindowStore({ limit, windowMs }: typeof policy, now: () => number): RemoteLimit {
  const counts = new Map<string, number>()
  return async (key) => {
    const bucket = Math.floor(now() / windowMs)
    const bucketKey = `${key}:${bucket}`
    const count = (counts.get(bucketKey) ?? 0) + 1
    counts.set(bucketKey, count)
    return { success: count <= limit, reset: (bucket + 1) * windowMs }
  }
}

const unreachable: RemoteLimit = async () => {
  throw new Error('connect ETIMEDOUT')
}

const timedOut: RemoteLimit = async () => ({ success: true, reset: 0, reason: 'timeout' })

async function allowedOver(limiter: ReturnType<typeof createSharedRateLimiter>, calls: number) {
  const allowed: boolean[] = []
  for (let i = 0; i < calls; i++) allowed.push((await limiter.check('a')).allowed)
  return allowed
}

describe('createSharedRateLimiter', () => {
  it('allows what the store allows and refuses the rest with the seconds left in its window', async () => {
    const time = clock(1_000_000)
    const limiter = createSharedRateLimiter(fixedWindowStore(policy, time.now), createRateLimiter(policy, time), time.now)
    expect(await allowedOver(limiter, 3)).toEqual([true, true, true])
    expect(await limiter.check('a')).toEqual({ allowed: false, retryAfterS: 10 })
  })

  it('never reports a retry time below one second', async () => {
    const refusing: RemoteLimit = async () => ({ success: false, reset: 0 })
    const limiter = createSharedRateLimiter(refusing, createRateLimiter(policy), () => 5_000)
    expect(await limiter.check('a')).toEqual({ allowed: false, retryAfterS: 1 })
  })

  it('counts in memory for that request when the store fails', async () => {
    const time = clock()
    const limiter = createSharedRateLimiter(unreachable, createRateLimiter(policy, time), time.now)
    expect(await allowedOver(limiter, 4)).toEqual([true, true, true, false])
  })

  it('counts in memory when the store reports a timeout instead of an answer', async () => {
    const time = clock()
    const limiter = createSharedRateLimiter(timedOut, createRateLimiter(policy, time), time.now)
    expect(await allowedOver(limiter, 4)).toEqual([true, true, true, false])
  })

  it('goes back to the store once it answers again', async () => {
    const time = clock()
    const store = fixedWindowStore({ limit: 1, windowMs: policy.windowMs }, time.now)
    let reachable = false
    const limiter = createSharedRateLimiter((key) => (reachable ? store(key) : unreachable(key)), createRateLimiter(policy, time), time.now)
    await limiter.check('a')
    reachable = true
    expect((await limiter.check('a')).allowed).toBe(true)
    expect((await limiter.check('a')).allowed).toBe(false)
  })

  it('allows and refuses exactly as the in-memory limiter does within one window, for any limit and call pattern', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 6 }),
        fc.array(fc.tuple(fc.constantFrom('a', 'b', 'c'), fc.integer({ min: 0, max: 300 })), { minLength: 1, maxLength: 30 }),
        async (limit, calls) => {
          const rules = { limit, windowMs: 10_000 }
          const memoryTime = clock(0)
          const sharedTime = clock(0)
          const memory = createRateLimiter(rules, memoryTime)
          const shared = createSharedRateLimiter(fixedWindowStore(rules, sharedTime.now), createRateLimiter(rules, sharedTime), sharedTime.now)
          for (const [key, gap] of calls) {
            memoryTime.advance(gap)
            sharedTime.advance(gap)
            expect((await shared.check(key)).allowed).toBe(memory.check(key).allowed)
          }
        },
      ),
    )
  })
})
