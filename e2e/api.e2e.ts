import type { APIResponse } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { ROUTE_RATE_LIMITS } from '../src/rate-limit/assumptions'

const BANGKOK_BBOX = '100.5671,13.7632,100.5709,13.7668'
const BURSTING_CLIENT = '203.0.113.77'
const EXTRA_REQUESTS = 5

const MUST_NOT_BE_CACHED = 'no-store'
const PUBLICLY_CACHED = /^public, max-age=\d+, s-maxage=\d+, stale-while-revalidate=\d+$/

const rejections = [
  { route: '/api/site', query: '', message: 'bbox is required' },
  { route: '/api/site', query: '?bbox=1,2,3', message: 'four numbers' },
  { route: '/api/site', query: '?bbox=a,b,c,d', message: 'four numbers' },
  { route: '/api/site', query: '?bbox=100.6,13.8,100.5,13.7', message: 'minimums must be below maximums' },
  { route: '/api/site', query: '?bbox=77.58,12.97,77.59,12.98', message: 'Thailand' },
  { route: '/api/site', query: '?bbox=100.5,13.7,100.6,13.8', message: 'too large' },
  { route: '/api/geocode', query: '', message: 'q is required' },
  { route: '/api/geocode', query: '?q=a', message: 'at least' },
  { route: '/api/geocode', query: `?q=${'a'.repeat(101)}`, message: 'at most' },
  { route: '/api/geocode', query: '?q=%21%21%21', message: 'letter or digit' },
]

async function expectJsonError(response: APIResponse, message: string) {
  expect(response.status()).toBe(400)
  expect(response.headers()['content-type']).toContain('application/json')
  expect(response.headers()['cache-control']).toBe(MUST_NOT_BE_CACHED)
  const body = await response.json()
  expect(Object.keys(body)).toEqual(['error'])
  expect(body.error).toContain(message)
}

function expectCachingToFollowOutcome(response: APIResponse, cacheable: boolean) {
  const header = response.headers()['cache-control']
  if (cacheable) expect(header).toMatch(PUBLICLY_CACHED)
  else expect(header).toBe(MUST_NOT_BE_CACHED)
}

test.describe('input validation', () => {
  for (const { route, query, message } of rejections)
    test(`${route}${query.slice(0, 48)} answers 400 with a JSON error mentioning "${message}"`, async ({ request }) => {
      await expectJsonError(await request.get(`${route}${query}`), message)
    })

  for (const route of ['/api/site', '/api/geocode'])
    test(`${route} accepts only GET`, async ({ request }) => {
      expect((await request.post(route)).status()).toBe(405)
    })
})

test.describe('caching headers', () => {
  test('/api/site caches a successful answer publicly and never a failed one', async ({ request }) => {
    const response = await request.get(`/api/site?bbox=${BANGKOK_BBOX}`)
    expect([200, 502]).toContain(response.status())
    expectCachingToFollowOutcome(response, response.ok())
    if (response.ok()) expect((await response.json()).bbox).toHaveLength(4)
  })

  test('/api/geocode caches a successful answer publicly and never a failed one', async ({ request }) => {
    const response = await request.get('/api/geocode?q=asok')
    expect([200, 502]).toContain(response.status())
    expectCachingToFollowOutcome(response, response.ok())
    if (response.ok()) expect(Array.isArray(await response.json())).toBe(true)
  })

  test('/api/geocode serves the same cached answer for a query written in other letter case and spacing', async ({ request }) => {
    const plain = await request.get('/api/geocode?q=asok')
    test.skip(!plain.ok(), 'the geocoder is unreachable from here')
    const spaced = await request.get('/api/geocode?q=%20%20ASOK%20')
    expect(spaced.status()).toBe(200)
    expect(await spaced.json()).toEqual(await plain.json())
    expect(spaced.headers()['cache-control']).toBe(plain.headers()['cache-control'])
  })
})

test.describe('rate limiting', () => {
  test.skip(!!process.env.E2E_URL, 'the live site overwrites the forwarded address, so one client cannot be simulated there')

  test('a concurrent burst on /api/site lets the limit through and refuses the rest with Retry-After', async ({ request }) => {
    const { limit, windowMs } = ROUTE_RATE_LIMITS.value.site
    const responses = await Promise.all(
      Array.from({ length: limit + EXTRA_REQUESTS }, () => request.get('/api/site', { headers: { 'x-forwarded-for': BURSTING_CLIENT } })),
    )
    const statuses = responses.map((response) => response.status())
    expect(statuses.filter((status) => status === 400)).toHaveLength(limit)
    const refused = responses.filter((response) => response.status() === 429)
    expect(refused).toHaveLength(EXTRA_REQUESTS)
    for (const response of refused) {
      expect(Number(response.headers()['retry-after'])).toBeGreaterThan(0)
      expect(Number(response.headers()['retry-after'])).toBeLessThanOrEqual(windowMs / 1000)
    }
  })
})
