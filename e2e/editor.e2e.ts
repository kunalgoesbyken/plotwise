import { expect, test, type Page } from '@playwright/test'
import { decodePlot } from '../src/editor/plot-url'
import type { Place } from '../src/geocode/schema'
import { EXAMPLE_PLOT } from '../src/plot/example-plot'
import type { Road, Station } from '../src/site/schema'

const L_SHAPE = [
  [300, 300],
  [300, 560],
  [440, 560],
  [440, 420],
  [560, 420],
  [560, 300],
] as const

const SOI_NORTH_OF_EXAMPLE: Road = {
  id: 'soi',
  line: [
    [100.5758031, 13.7792149],
    [100.5752386, 13.7790861],
  ],
  highway: 'residential',
  widthM: 9,
  widthSource: 'lanes',
  grade: 'ground',
  oneway: false,
}

const PLATFORM_THROUGH_START_VIEW: Station = {
  id: 'way/1',
  name: 'Test Platform',
  kind: 'platform',
  geometry: {
    type: 'line',
    line: [
      [100.5268, 13.72],
      [100.5268, 13.73],
    ],
  },
}

const ASOK: Place = { id: 'N1', label: 'Asok, Watthana, Bangkok', lngLat: [100.5604, 13.7372], kind: 'locality' }

async function open(page: Page, path = '/app', roads: Road[] = [], stations: Station[] = []) {
  await page.route('**/api/site?**', (route) => {
    const bbox = new URL(route.request().url()).searchParams.get('bbox')!.split(',').map(Number)
    return route.fulfill({ json: { bbox, buildings: [], roads, stations, attribution: 'test' } })
  })
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto(path)
  await page.locator('[data-map-ready="true"]').waitFor({ timeout: 30_000 })
  return errors
}

async function draw(page: Page, points: readonly (readonly [number, number])[]) {
  for (const [x, y] of points) await page.mouse.click(x, y)
  await page.mouse.click(points[0][0], points[0][1])
}

async function plotInUrl(page: Page) {
  await expect.poll(() => new URL(page.url()).hash).toContain('plot=')
  const link = decodePlot(new URL(page.url()).hash)
  return link?.ok ? link.plot : null
}

async function settledCorner(page: Page, name: string): Promise<[number, number]> {
  const label = page.locator('.map-label-corner').getByText(name, { exact: true })
  const centre = async () => {
    const box = (await label.boundingBox())!
    return [Math.round(box.x + box.width / 2 - 14), Math.round(box.y + box.height / 2 + 14)] as [number, number]
  }
  let last: [number, number] = [Number.NaN, Number.NaN]
  await expect
    .poll(async () => {
      const [previous, now] = [last, await centre()]
      last = now
      return now[0] === previous[0] && now[1] === previous[1]
    }, { intervals: [150] })
    .toBe(true)
  return last
}

const hint = (page: Page) => page.getByRole('status')
const site = (page: Page) => page.getByRole('complementary', { name: 'Plot settings' })
const goTo = (page: Page, step: 'Plot' | 'Roads' | 'Results') => page.getByRole('navigation', { name: 'Steps' }).getByRole('button', { name: step }).click()
const frontageRows = (page: Page) => page.getByRole('region', { name: 'Road frontage' }).getByRole('listitem')

test('draws a concave plot, marks a road, picks a type and restores it all from the URL', async ({ page }) => {
  const errors = await open(page)
  await draw(page, L_SHAPE)
  await expect(frontageRows(page)).toHaveCount(6)
  await expect(hint(page)).toContainText('edge that faces a road')

  await page.mouse.click(300, 365)
  const width = page.getByLabel('Road width on edge A–B, in metres')
  await expect(width).toBeFocused()
  await width.fill('16')
  await page.getByRole('button', { name: 'See results' }).click()
  await page.getByRole('radio', { name: 'Hotel' }).click()

  const plot = await plotInUrl(page)
  expect(plot?.ring).toHaveLength(6)
  expect(plot?.roads).toEqual([{ edge: 0, widthM: 16 }])
  await expect.poll(async () => (await plotInUrl(page))?.buildingType).toBe('hotel')
  const link = page.url()

  await page.reload()
  await page.locator('[data-map-ready="true"]').waitFor({ timeout: 30_000 })
  await expect(page.getByRole('radio', { name: 'Hotel' })).toBeChecked()
  await expect(hint(page)).toContainText('Drag a corner')
  await goTo(page, 'Roads')
  await expect(frontageRows(page)).toHaveCount(6)
  await expect(page.getByLabel('Road width on edge A–B, in metres')).toHaveValue('16')
  expect(page.url()).toBe(link)
  await page.screenshot({ path: 'e2e/.results/editor-1280.png' })
  expect(errors).toEqual([])
})

test('refuses a corner that would make the outline cross itself', async ({ page }) => {
  await open(page)
  for (const [x, y] of [
    [300, 300],
    [500, 300],
    [500, 500],
    [400, 250],
  ])
    await page.mouse.click(x, y)
  await expect(hint(page)).toContainText('can’t cross')
  await expect(site(page).getByText('3 corners')).toBeVisible()
})

test('drags a corner, inserts one on an edge and deletes it again', async ({ page }) => {
  await open(page)
  await draw(page, L_SHAPE)
  await page.getByRole('button', { name: 'Mark as road, edge A–B' }).click()
  await page.getByLabel('Road width on edge A–B, in metres').fill('10')
  const before = await plotInUrl(page)

  const [dx, dy] = await settledCorner(page, 'D')
  await page.mouse.move(dx, dy)
  await page.mouse.down()
  await page.mouse.move(dx + 30, dy + 30, { steps: 5 })
  await page.mouse.up()
  await expect.poll(async () => (await plotInUrl(page))?.ring[3]).not.toEqual(before?.ring[3])

  const [[ax, ay], [fx, fy]] = [await settledCorner(page, 'A'), await settledCorner(page, 'F')]
  const [mx, my] = [(ax + fx) / 2, (ay + fy) / 2]
  await page.mouse.move(mx, my)
  await page.mouse.down()
  await page.mouse.move(mx, my - 40, { steps: 5 })
  await page.mouse.up()
  await expect.poll(async () => (await plotInUrl(page))?.ring).toHaveLength(7)
  await expect(hint(page)).toContainText('Corner G')
  await page.keyboard.press('Delete')
  await expect.poll(async () => (await plotInUrl(page))?.ring).toHaveLength(6)
})

test('says why a link was not opened and still starts empty', async ({ page }) => {
  const errors = await open(page, '/app#plot=1,2;garbage&roads=0:-1&type=castle')
  await expect(hint(page)).toContainText('This link’s plot is not valid')
  await expect(page.getByRole('button', { name: 'Try an example plot' })).toBeVisible()
  expect(errors).toEqual([])
})

test('says when a link is missing part of the plot', async ({ page }) => {
  await open(page, '/app#plot=100.5,13.7;100.51,13.7;100.51,13.71&roads=0:12')
  await expect(hint(page)).toContainText('This link is missing part of the plot')
})

test('the example plot opens on the roads step with its road selected and its width shown', async ({ page }) => {
  await open(page)
  await expect(page.getByText('Check what a Bangkok plot can hold before you buy it.')).toBeVisible()
  await page.getByRole('button', { name: 'Try an example plot' }).click()
  await expect(page.getByRole('region', { name: 'Road frontage' })).toBeVisible()
  await expect(page.getByLabel('Road width on edge A–B, in metres')).toHaveValue('12')
  await expect(page.getByRole('listitem').filter({ hasText: 'A–B' })).toHaveAttribute('aria-current', 'true')
  await expect(page).toHaveURL(/#plot=/)
  await page.getByRole('button', { name: 'See results' }).click()
  await expect(page.getByRole('region', { name: 'Building type' })).toBeVisible()
  await page.getByRole('navigation', { name: 'Steps' }).getByRole('button', { name: 'Roads' }).click()
  await expect(page.getByRole('region', { name: 'Road frontage' })).toBeVisible()
})

test('a plot opened from a link goes straight to the results', async ({ page }) => {
  await open(page, '/app#plot=100.5262,13.7228;100.526774,13.7228;100.526774,13.723052;100.526163,13.72325&roads=0:12&type=condo')
  await expect(page.getByRole('region', { name: 'Building type' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Road frontage' })).toHaveCount(0)
})

test('names the one zone it covers and links the official map to confirm it', async ({ page }) => {
  await open(page, '/app')
  await expect(page.getByText('Brown zone · very high-density residential')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Check your plot is in it' })).toHaveAttribute('href', /bangkok\.go\.th/)
})

test('works from the keyboard, and suggests a mapped road width that stays editable', async ({ page }) => {
  await open(page, '/app', [SOI_NORTH_OF_EXAMPLE])
  await page.getByRole('button', { name: 'Try an example plot' }).focus()
  await page.keyboard.press('Enter')
  await page.getByRole('navigation', { name: 'Steps' }).getByRole('button', { name: 'Roads' }).focus()
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Mark as road, edge C–D' }).focus()
  await page.keyboard.press('Enter')
  const width = page.getByLabel('Road width on edge C–D, in metres')
  await expect(width).toBeFocused()
  await expect(width).toHaveValue('9')
  await expect(site(page).getByText('Estimated from OpenStreetMap')).toBeVisible()
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.type('8')
  await expect(site(page).getByText('Estimated from OpenStreetMap')).toBeHidden()
  await page.getByRole('button', { name: 'See results' }).focus()
  await page.keyboard.press('Enter')
  await page.getByRole('radio', { name: 'Condominium' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('radio', { name: 'Office' })).toBeFocused()
  await page.keyboard.press('Space')
  await expect(page.getByRole('radio', { name: 'Office' })).toBeChecked()
  await expect.poll(async () => (await plotInUrl(page))?.roads).toEqual([
    ...EXAMPLE_PLOT.roads.slice(0, 2),
    { edge: 2, widthM: 8 },
    EXAMPLE_PLOT.roads[2],
  ])
})

async function frontageColumns(page: Page) {
  return frontageRows(page).evaluateAll((items) =>
    items.map((item) => {
      const [, width, action] = [...item.children].map((cell) => cell.getBoundingClientRect())
      return { width: Math.round(width.left), actionLeft: Math.round(action.left), actionRight: Math.round(action.right), height: Math.round(item.getBoundingClientRect().height) }
    }),
  )
}

for (const width of [536, 1280])
  test(`road frontage rows keep one column grid at ${width} px, with or without an estimated width`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await open(page, '/app', [SOI_NORTH_OF_EXAMPLE])
    await page.getByRole('button', { name: 'Try an example plot' }).click()
    await goTo(page, 'Roads')
    await page.getByRole('button', { name: 'Mark as road, edge C–D' }).click()
    await expect(site(page).getByText('Estimated from OpenStreetMap, check on site.')).toBeVisible()
    const rows = await frontageColumns(page)
    expect(rows).toHaveLength(EXAMPLE_PLOT.ring.length)
    for (const key of ['width', 'actionLeft', 'actionRight', 'height'] as const)
      expect(new Set(rows.map((row) => row[key])).size, `${key} differs between rows`).toBe(1)
    const roadInput = await page.getByLabel('Road width on edge C–D, in metres').boundingBox()
    expect(Math.round(roadInput!.x)).toBe(rows[0].width)
  })

test('suggests places while typing and draws the plot at the one picked', async ({ page }) => {
  await page.route('**/api/geocode?**', (route) => route.fulfill({ json: [ASOK] }))
  const errors = await open(page)
  await page.getByRole('combobox', { name: 'Search for an address or place in Thailand' }).fill('asok')
  const result = page.getByRole('listbox', { name: 'Places found' }).getByRole('option')
  await expect(result).toHaveText('Asok, Watthana, Bangkok')
  await result.click()
  await expect(page.getByRole('listbox', { name: 'Places found' })).toBeHidden()
  await page.waitForTimeout(1_000)
  await expect(page.getByRole('listbox', { name: 'Places found' })).toBeHidden()
  await page.waitForTimeout(4_000)
  await draw(page, [
    [600, 380],
    [700, 380],
    [650, 460],
  ])
  await page.getByRole('button', { name: 'Mark as road, edge A–B' }).click()
  await page.getByLabel('Road width on edge A–B, in metres').fill('10')
  const [lng, lat] = (await plotInUrl(page))!.ring[0]
  expect(Math.abs(lng - ASOK.lngLat[0])).toBeLessThan(0.01)
  expect(Math.abs(lat - ASOK.lngLat[1])).toBeLessThan(0.01)
  expect(errors).toEqual([])
})

test('says when place search is down instead of failing silently', async ({ page }) => {
  await page.route('**/api/geocode?**', (route) => route.fulfill({ status: 502, json: { error: 'down' } }))
  await open(page)
  await page.getByLabel('Search for an address or place in Thailand').fill('asok')
  await expect(site(page).getByText('Place search is unavailable right now')).toBeVisible()
})

test('turns on the station switch from the nearest mapped platform as an estimate the user can override', async ({ page }) => {
  await open(page, '/app', [], [PLATFORM_THROUGH_START_VIEW])
  await draw(page, L_SHAPE)
  await page.getByRole('button', { name: 'Mark as road, edge A–B' }).click()
  await page.getByLabel('Road width on edge A–B, in metres').fill('10')
  const near = page.getByRole('switch', { name: /Within 500\sm of a BTS\/MRT station/ })
  await expect(site(page).getByText(/Nearest mapped platform: Test Platform, [\d.,]+\sm from the plot/)).toBeVisible()
  await expect(near).toBeChecked()
  await near.uncheck()
  await expect.poll(async () => (await plotInUrl(page))?.nearStation).toBe(false)
  await expect(site(page).getByText('est.', { exact: true })).toHaveCount(0)
})

async function layout(page: Page) {
  return page.evaluate(() => {
    const panel = document.querySelector('aside')!.getBoundingClientRect()
    const status = document.querySelector('[role="status"]')!.getBoundingClientRect()
    const targets = [...document.querySelectorAll('aside button, aside input[type="text"], aside label:not(.sr-only), [role="status"] button')]
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0)
    return {
      scrollW: document.documentElement.scrollWidth,
      scrollH: document.documentElement.scrollHeight,
      panel: { left: panel.left, right: panel.right, top: panel.top, bottom: panel.bottom },
      statusRight: status.right,
      smallestTarget: Math.min(...targets.map((r) => Math.min(r.height, r.width))),
    }
  })
}

test('phone layout at 375 px: bottom sheet, no overflow, 44 px targets, drawing still works', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await open(page)
  const l = await layout(page)
  expect(l.scrollW).toBe(375)
  expect(l.scrollH).toBe(812)
  expect(l.panel.left).toBe(0)
  expect(l.panel.right).toBe(375)
  expect(l.panel.bottom).toBe(812)
  expect(l.smallestTarget).toBeGreaterThanOrEqual(44)

  await page.getByRole('button', { name: 'Hide panel' }).click()
  await draw(page, [
    [60, 200],
    [60, 420],
    [190, 300],
    [300, 420],
    [300, 200],
  ])
  await expect(page.getByLabel('Road width on edge A–B, in metres')).toBeHidden()
  const [[ax, ay], [bx, by]] = [await settledCorner(page, 'A'), await settledCorner(page, 'B')]
  await page.mouse.click(ax + (bx - ax) / 4, ay + (by - ay) / 4)
  await expect(page.getByLabel('Road width on edge A–B, in metres')).toBeVisible()
  await page.getByLabel('Road width on edge A–B, in metres').fill('10')
  await page.getByRole('button', { name: 'See results' }).click()
  await expect(page.getByRole('region', { name: 'Building type' })).toBeVisible()
  await page.getByRole('tab', { name: 'Rules' }).click()
  await expect(page.getByRole('tabpanel', { name: 'Rules' })).toBeVisible()
  await page.screenshot({ path: 'e2e/.results/editor-375.png' })
})

test('desktop layout at 1280 px: side panel beside the map, nothing overflows', async ({ page }) => {
  await open(page)
  const l = await layout(page)
  expect(l.scrollW).toBe(1280)
  expect(l.scrollH).toBe(800)
  expect(l.panel.right).toBeLessThanOrEqual(1280)
  expect(l.panel.left).toBeGreaterThan(800)
  expect(l.statusRight).toBeLessThan(l.panel.left)
  await expect(page.getByRole('navigation', { name: 'Steps' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Find the site' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Road frontage' })).toHaveCount(0)
  await expect(page.getByRole('navigation', { name: 'Steps' }).getByRole('button', { name: 'Roads' })).toBeDisabled()
})
