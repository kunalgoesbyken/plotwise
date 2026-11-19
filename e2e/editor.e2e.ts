import { expect, test, type Page } from '@playwright/test'
import { decodePlot } from '../src/editor/plot-url'
import type { Road } from '../src/site/schema'

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
    [100.5265, 13.7231239],
    [100.5269, 13.7231239],
  ],
  highway: 'residential',
  widthM: 9,
  widthSource: 'lanes',
  grade: 'ground',
}

async function open(page: Page, path = '/', roads: Road[] = []) {
  await page.route('**/api/site?**', (route) => {
    const bbox = new URL(route.request().url()).searchParams.get('bbox')!.split(',').map(Number)
    return route.fulfill({ json: { bbox, buildings: [], roads, attribution: 'test' } })
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
  return decodePlot(new URL(page.url()).hash)
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

test('draws a concave plot, marks a road, picks a type and restores it all from the URL', async ({ page }) => {
  const errors = await open(page)
  await draw(page, L_SHAPE)
  await expect(site(page).getByText('6 corners')).toBeVisible()
  await expect(hint(page)).toContainText('edge that faces a road')

  await page.mouse.click(300, 365)
  const width = page.getByLabel('Road width on edge A–B, in metres')
  await expect(width).toBeFocused()
  await width.fill('16')
  await page.getByText('Hotel', { exact: true }).click()

  const plot = await plotInUrl(page)
  expect(plot?.ring).toHaveLength(6)
  expect(plot?.roads).toEqual([{ edge: 0, widthM: 16 }])
  await expect.poll(async () => (await plotInUrl(page))?.buildingType).toBe('hotel')
  const link = page.url()

  await page.reload()
  await page.locator('[data-map-ready="true"]').waitFor({ timeout: 30_000 })
  await expect(site(page).getByText('6 corners')).toBeVisible()
  await expect(page.getByLabel('Road width on edge A–B, in metres')).toHaveValue('16')
  await expect(page.getByRole('radio', { name: 'Hotel' })).toBeChecked()
  await expect(hint(page)).toContainText('Drag a corner')
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
  await page.getByRole('button', { name: 'Mark edge A–B as a road' }).click()
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
  await expect(site(page).getByText('7 corners')).toBeVisible()
  await expect(hint(page)).toContainText('Corner G')
  await page.keyboard.press('Delete')
  await expect(site(page).getByText('6 corners')).toBeVisible()
  await expect.poll(async () => (await plotInUrl(page))?.ring).toHaveLength(6)
})

test('ignores a malformed link and starts empty', async ({ page }) => {
  const errors = await open(page, '/#plot=1,2;garbage&roads=0:-1&type=castle')
  await expect(hint(page)).toContainText('first corner')
  expect(errors).toEqual([])
})

test('names the one zone it covers and links the official map to confirm it', async ({ page }) => {
  await open(page, '/')
  await expect(page.getByText('ย.9 · very high-density residential')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Check the zone on the BMA city plan' })).toHaveAttribute('href', /bangkok\.go\.th/)
})

test('works from the keyboard, and suggests a mapped road width that stays editable', async ({ page }) => {
  await open(page, '/', [SOI_NORTH_OF_EXAMPLE])
  await page.getByRole('button', { name: 'Use an example plot' }).focus()
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Mark edge C–D as a road' }).focus()
  await page.keyboard.press('Enter')
  const width = page.getByLabel('Road width on edge C–D, in metres')
  await expect(width).toBeFocused()
  await expect(width).toHaveValue('9')
  await expect(site(page).getByText('Estimated from OpenStreetMap')).toBeVisible()
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.type('8')
  await expect(site(page).getByText('Estimated from OpenStreetMap')).toBeHidden()
  await page.getByRole('radio', { name: 'Condominium' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('radio', { name: 'Office' })).toBeChecked()
  await expect.poll(async () => (await plotInUrl(page))?.roads).toEqual([
    { edge: 0, widthM: 12 },
    { edge: 2, widthM: 8 },
  ])
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

  await page.getByRole('button', { name: 'Site', exact: true }).click()
  await draw(page, [
    [60, 200],
    [60, 420],
    [190, 300],
    [300, 420],
    [300, 200],
  ])
  await expect(page.getByLabel('Road width on edge A–B, in metres')).toBeHidden()
  await page.mouse.click(60, 260)
  await expect(page.getByLabel('Road width on edge A–B, in metres')).toBeVisible()
  await page.getByRole('button', { name: 'Rules', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Rules' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Building type' })).toBeHidden()
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
  await expect(page.getByRole('navigation', { name: 'Panels' })).toBeHidden()
  for (const name of ['Plot', 'Road frontage', 'Building type', 'Rules', 'Designs'])
    await expect(page.getByRole('region', { name, exact: true })).toBeVisible()
})
