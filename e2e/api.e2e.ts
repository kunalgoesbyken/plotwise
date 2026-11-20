import type { APIResponse } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { encodeRing } from '../src/zone/schema'
import { RESULTS_PLOT } from './support/site'

const BANGKOK_BBOX = '100.5671,13.7632,100.5709,13.7668'
const BANGKOK_RING = encodeRing(RESULTS_PLOT.ring)
const BURST_REQUESTS = 120

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
  { route: '/api/zone', query: '', message: 'ring is required' },
  { route: '/api/zone', query: '?ring=100.5,13.7', message: 'at least three' },
  { route: '/api/zone', query: '?ring=a,b;c,d;e,f', message: 'at least three' },
  { route: '/api/zone', query: '?ring=500,13.7;100.5,13.7;100.5,13.8', message: 'at least three' },
  { route: '/api/zone', query: '?ring=100.5,13.7;100.9,13.7;100.9,14.2', message: 'must fit within' },
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

  for (const route of ['/api/site', '/api/geocode', '/api/zone'])
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
    const [plain, spaced] = await Promise.all([request.get('/api/geocode?q=asok'), request.get('/api/geocode?q=%20%20ASOK%20')])
    expect(spaced.status()).toBe(plain.status())
    if (plain.ok()) expect(await spaced.json()).toEqual(await plain.json())
  })

  test('/api/zone caches a checked zone publicly and never an unchecked one', async ({ request }) => {
    const response = await request.get(`/api/zone?ring=${BANGKOK_RING}`)
    expect(response.status()).toBe(200)
    const verdict = await response.json()
    expect(['inside', 'outside', 'mixed', 'unknown']).toContain(verdict.status)
    expectCachingToFollowOutcome(response, verdict.status !== 'unknown')
  })
})

test.describe('rate limiting', () => {
  test.fixme('waits for the rate limiter to merge: a burst of /api/zone requests gets a 429 with a Retry-After header', async ({ request }) => {
    const responses = await Promise.all(Array.from({ length: BURST_REQUESTS }, () => request.get(`/api/zone?ring=${BANGKOK_RING}`)))
    const limited = responses.filter((response) => response.status() === 429)
    expect(limited.length).toBeGreaterThan(0)
    for (const response of limited) expect(Number(response.headers()['retry-after'])).toBeGreaterThan(0)
  })
})
