import { describe, expect, it } from 'bun:test'
import fc from 'fast-check'
import { createRateLimiter } from './limiter'

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

describe('createRateLimiter', () => {
  it('allows up to the limit and then refuses with the seconds left in the window', () => {
    const time = clock()
    const limiter = createRateLimiter(policy, time)
    expect([1, 2, 3].map(() => limiter.check('a').allowed)).toEqual([true, true, true])
    time.advance(2_500)
    expect(limiter.check('a')).toEqual({ allowed: false, retryAfterS: 8 })
  })

  it('opens a fresh window once the old one has passed', () => {
    const time = clock()
    const limiter = createRateLimiter(policy, time)
    for (let i = 0; i < 4; i++) limiter.check('a')
    time.advance(policy.windowMs)
    expect(limiter.check('a')).toEqual({ allowed: true })
  })

  it('counts each client on its own', () => {
    const limiter = createRateLimiter(policy, clock())
    for (let i = 0; i < 4; i++) limiter.check('a')
    expect(limiter.check('b')).toEqual({ allowed: true })
  })

  it('never reports a retry time below one second or above the window', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: policy.windowMs - 1 }), (elapsed) => {
        const time = clock()
        const limiter = createRateLimiter(policy, time)
        for (let i = 0; i < policy.limit; i++) limiter.check('a')
        time.advance(elapsed)
        const decision = limiter.check('a')
        expect(decision.allowed).toBe(false)
        if (decision.allowed) return
        expect(decision.retryAfterS).toBeGreaterThanOrEqual(1)
        expect(decision.retryAfterS).toBeLessThanOrEqual(policy.windowMs / 1000)
      }),
    )
  })

  it('allows exactly the limit in one window for any call pattern', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 1_000 }), { minLength: 1, maxLength: 9 }), (gaps) => {
        const time = clock()
        const limiter = createRateLimiter({ limit: 5, windowMs: 10_000 }, time)
        const allowed = gaps.filter((gap) => {
          time.advance(gap)
          return limiter.check('a').allowed
        })
        expect(allowed.length).toBe(Math.min(gaps.length, 5))
      }),
    )
  })

  it('drops the oldest client when the cap is reached, and keeps the newest limited', () => {
    const time = clock()
    const limiter = createRateLimiter(policy, { ...time, maxKeys: 2 })
    for (const key of ['a', 'b', 'c']) {
      for (let i = 0; i < 4; i++) limiter.check(key)
      time.advance(1)
    }
    expect(limiter.check('c').allowed).toBe(false)
    expect(limiter.check('b').allowed).toBe(false)
    expect(limiter.check('a').allowed).toBe(true)
  })

  it('forgets expired clients before dropping live ones', () => {
    const time = clock()
    const limiter = createRateLimiter(policy, { ...time, maxKeys: 2 })
    limiter.check('old')
    time.advance(policy.windowMs)
    for (let i = 0; i < 4; i++) limiter.check('live')
    limiter.check('newer')
    expect(limiter.check('live').allowed).toBe(false)
  })
})
