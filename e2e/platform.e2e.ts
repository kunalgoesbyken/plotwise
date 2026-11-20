import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { encodePlot } from '../src/editor/plot-url'
import { PLACES_CACHE_S } from '../src/geocode/assumptions'
import { EXAMPLE_PLOT } from '../src/plot/example-plot'
import { ROUTE_RATE_LIMITS } from '../src/rate-limit/assumptions'

const ROUTES = {
  geocode: '/api/geocode',
  site: '/api/site',
  zone: '/api/zone',
} as const

const addresses = new Map<string, string>()

function clientFor(name: string): string {
  if (!addresses.has(name)) addresses.set(name, `203.0.113.${addresses.size + 1}`)
  return addresses.get(name)!
}

const ASOK = { id: 'N1', label: 'Asok, Watthana, Bangkok', lngLat: [100.5604, 13.7372], kind: 'locality' }

async function recordViolations(page: Page) {
  const reports: string[] = []
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      console.error(`securitypolicyviolation ${event.violatedDirective} ${event.blockedURI}`)
    })
  })
  page.on('console', (message) => {
    if (/Content Security Policy|securitypolicyviolation|Refused to/.test(message.text())) reports.push(message.text())
  })
  page.on('pageerror', (error) => reports.push(error.message))
  return reports
}

for (const path of ['/', '/app']) {
  test(`${path} sends the security headers`, async ({ request }) => {
    const headers = (await request.get(path)).headers()
    const csp = headers['content-security-policy']
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain('connect-src')
    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['x-frame-options']).toBe('DENY')
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin')
    expect(headers['permissions-policy']).toContain('camera=()')
  })
}

test('the landing page runs without a single policy violation', async ({ page }) => {
  const reports = await recordViolations(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.getByRole('button', { name: 'Can I share a result?' }).click()
  expect(reports).toEqual([])
})

test('the map, its worker and the place search run without a single policy violation', async ({ page }) => {
  const reports = await recordViolations(page)
  await page.route('**/api/geocode?**', (route) => route.fulfill({ json: [ASOK] }))
  const worker = page.waitForResponse((response) => response.url().includes('maplibre-gl-worker.mjs'))
  await page.goto('/app')
  await page.locator('[data-map-ready="true"]').waitFor({ timeout: 30_000 })
  expect((await worker).status()).toBe(200)
  await page.getByRole('combobox', { name: 'Search for an address or place in Thailand' }).fill('asok')
  await expect(page.getByRole('listbox', { name: 'Places found' }).getByRole('option')).toHaveText(ASOK.label)
  expect(reports).toEqual([])
})

test('the results and the 3D view run without a single policy violation', async ({ page }) => {
  const reports = await recordViolations(page)
  await page.route('**/api/zone?**', (route) => route.fulfill({ json: { status: 'inside', zone: 'brown zone 9 (very high-density residential)' } }))
  await page.goto(`/app#${encodePlot(EXAMPLE_PLOT)}`)
  await expect(page.locator('[data-scene-ready="true"]')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('table', { name: 'Designs compared', includeHidden: true })).toBeAttached()
  expect(reports).toEqual([])
})

for (const path of ['/', '/app']) {
  test(`${path} links a generated share card`, async ({ page, request }) => {
    await page.goto(path)
    expect(await page.locator('meta[name="twitter:card"]').getAttribute('content')).toBe('summary_large_image')
    const image = new URL((await page.locator('meta[property="og:image"]').getAttribute('content'))!)
    const response = await request.get(image.pathname + image.search)
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toBe('image/png')
  })
}

for (const [path, canonical] of [
  ['/', ''],
  ['/app', '/app'],
] as const) {
  test(`${path} names its canonical address`, async ({ page }) => {
    await page.goto(path)
    const href = await page.locator('link[rel="canonical"]').getAttribute('href')
    expect(new URL(href!).pathname.replace(/\/$/, '')).toBe(canonical)
  })
}

test('robots.txt hides the API and sitemap.xml lists both pages', async ({ request }) => {
  const robots = await (await request.get('/robots.txt')).text()
  expect(robots).toContain('Disallow: /api/')
  expect(robots).toContain('Sitemap: ')
  const sitemap = await (await request.get('/sitemap.xml')).text()
  expect(sitemap.match(/<loc>[^<]+<\/loc>/g)).toHaveLength(2)
  expect(sitemap).toContain('/app</loc>')
})

for (const route of Object.keys(ROUTES) as (keyof typeof ROUTES)[]) {
  test(`${ROUTES[route]} answers a bad request with 400 and is not cached`, async ({ request }) => {
    const response = await request.get(ROUTES[route], { headers: { 'x-forwarded-for': clientFor(`invalid-${route}`) } })
    expect(response.status()).toBe(400)
    expect(response.headers()['cache-control']).toBe('no-store')
  })
}

test('/api/geocode answers a real query with the CDN cache headers', async ({ request }) => {
  const response = await request.get(`${ROUTES.geocode}?q=asok`, { headers: { 'x-forwarded-for': clientFor('cache') } })
  test.skip(response.status() === 502, 'Photon is unreachable from here')
  expect(response.status()).toBe(200)
  const { browser, cdn, staleWhileRevalidate } = PLACES_CACHE_S.value
  expect(response.headers()['cache-control']).toBe(`public, max-age=${browser}, s-maxage=${cdn}, stale-while-revalidate=${staleWhileRevalidate}`)
})

async function exhaust(request: APIRequestContext, route: keyof typeof ROUTES, client: string) {
  const headers = { 'x-forwarded-for': clientFor(client) }
  const { limit } = ROUTE_RATE_LIMITS.value[route]
  for (let i = 0; i < limit; i++) expect((await request.get(ROUTES[route], { headers })).status()).toBe(400)
  return request.get(ROUTES[route], { headers })
}

test.describe('rate limits', () => {
  test.skip(!!process.env.E2E_URL, 'the live site overwrites the forwarded address, so one client cannot be simulated there')

  for (const route of Object.keys(ROUTES) as (keyof typeof ROUTES)[]) {
    test(`${ROUTES[route]} answers 429 with Retry-After after ${ROUTE_RATE_LIMITS.value[route].limit} requests in a window`, async ({ request }) => {
      const refused = await exhaust(request, route, `limit-${route}`)
      expect(refused.status()).toBe(429)
      expect(refused.headers()['cache-control']).toBe('no-store')
      const retryAfter = Number(refused.headers()['retry-after'])
      expect(retryAfter).toBeGreaterThanOrEqual(1)
      expect(retryAfter).toBeLessThanOrEqual(ROUTE_RATE_LIMITS.value[route].windowMs / 1000)
      expect(await refused.json()).toEqual({ error: 'Too many requests; try again shortly' })
    })
  }

  test('one client being refused does not affect another', async ({ request }) => {
    await exhaust(request, 'zone', 'noisy')
    const other = await request.get(ROUTES.zone, { headers: { 'x-forwarded-for': clientFor('bystander') } })
    expect(other.status()).toBe(400)
  })
})
