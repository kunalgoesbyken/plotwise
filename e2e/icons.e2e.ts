import { expect, test } from '@playwright/test'

const ICON_FILES = [
  { rel: 'icon', pathname: '/favicon.ico', contentType: 'image/x-icon' },
  { rel: 'icon', pathname: '/icon.svg', contentType: 'image/svg+xml' },
  { rel: 'apple-touch-icon', pathname: '/apple-icon.png', contentType: 'image/png' },
] as const

for (const path of ['/', '/app']) {
  for (const { rel, pathname, contentType } of ICON_FILES) {
    test(`${path} links ${pathname}, which is served as ${contentType}`, async ({ page, request }) => {
      await page.goto(path)
      const links = await page.locator(`head link[rel="${rel}"]`).evaluateAll((nodes) => nodes.map((node) => (node as HTMLLinkElement).href))
      const href = links.find((link) => new URL(link).pathname === pathname)
      expect(href, `no <link rel="${rel}"> for ${pathname}`).toBeDefined()

      const response = await request.get(href!)
      expect(response.status()).toBe(200)
      expect(response.headers()['content-type']).toContain(contentType)
      expect((await response.body()).length).toBeGreaterThan(0)
    })
  }

  test(`${path} links the web manifest`, async ({ page }) => {
    await page.goto(path)
    await expect(page.locator('head link[rel="manifest"]')).toHaveAttribute('href', '/manifest.webmanifest')
  })
}

test('the favicon holds 16, 32 and 48 pixel images', async ({ request }) => {
  const bytes = await (await request.get('/favicon.ico')).body()
  expect(bytes.readUInt16LE(2)).toBe(1)
  const count = bytes.readUInt16LE(4)
  const widths = Array.from({ length: count }, (_, index) => bytes.readUInt8(6 + 16 * index))
  expect(widths).toEqual([16, 32, 48])
})

for (const pathname of ['/apple-icon.png', '/apple-touch-icon.png', '/apple-touch-icon-precomposed.png']) {
  test(`${pathname} is the 180 pixel apple touch icon PNG`, async ({ request }) => {
    const response = await request.get(pathname)
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('image/png')
    const bytes = await response.body()
    expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG')
    expect(bytes.readUInt32BE(16)).toBe(180)
    expect(bytes.readUInt32BE(20)).toBe(180)
  })
}

test('the web manifest names the app, opens the app and lists icons that exist', async ({ request }) => {
  const response = await request.get('/manifest.webmanifest')
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toContain('application/manifest+json')

  const manifest = await response.json()
  expect(manifest.name).toBe('Plotwise')
  expect(manifest.short_name).toBe('Plotwise')
  expect(manifest.start_url).toBe('/app')
  expect(manifest.display).toBe('standalone')
  expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i)
  expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/i)
  expect(manifest.icons.length).toBeGreaterThan(0)

  for (const icon of manifest.icons) {
    const iconResponse = await request.get(icon.src)
    expect(iconResponse.status(), icon.src).toBe(200)
    expect(iconResponse.headers()['content-type']).toContain(icon.type)
  }
})
