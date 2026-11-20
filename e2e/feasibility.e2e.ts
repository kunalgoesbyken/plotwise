import { expect, test, type Page, type Route } from '@playwright/test'
import { encodePlot } from '../src/editor/plot-url'
import type { Plot } from '../src/plot/plot'
import fixture from '../src/site/__fixtures__/ratchadaphisek.overpass.json'
import { OverpassResponseSchema } from '../src/site/overpass-response'
import { parseOverpass } from '../src/site/parse'

const recorded = parseOverpass(OverpassResponseSchema.parse(fixture))

const PLOT: Plot = {
  ring: [
    [100.5686, 13.7648],
    [100.56915, 13.7648],
    [100.5692, 13.76525],
    [100.5689, 13.7655],
    [100.5686, 13.76545],
  ],
  roads: [{ edge: 0, widthM: 30 }],
  buildingType: 'condo',
  nearStation: false,
}

const fulfilSite = (route: Route) => {
  const bbox = new URL(route.request().url()).searchParams.get('bbox')!.split(',').map(Number)
  return route.fulfill({ json: { bbox, ...recorded, attribution: '© OpenStreetMap contributors (ODbL)' } })
}

async function open(page: Page, plot: Plot = PLOT) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.route('**/api/site?**', fulfilSite)
  await page.goto(`/#${encodePlot(plot)}`)
  await page.locator('[data-map-ready="true"]').waitFor({ timeout: 30_000 })
  await expect(page.getByRole('table', { name: 'Designs compared', includeHidden: true })).toBeAttached({ timeout: 30_000 })
  return errors
}

const rules = (page: Page) => page.getByRole('tabpanel', { name: 'Rules', includeHidden: true })
const designsRegion = (page: Page) => page.getByRole('tabpanel', { name: 'Designs', includeHidden: true })
const showTab = (page: Page, name: 'Designs' | 'Rules' | '3D') => page.getByRole('tab', { name, exact: true }).click()
const goTo = (page: Page, step: 'Roads' | 'Results') => page.getByRole('navigation', { name: 'Steps' }).getByRole('button', { name: step }).click()
const designTable = (page: Page) => designsRegion(page).getByRole('table', { name: 'Designs compared' })
const designButtons = (page: Page) => designTable(page).getByRole('button', { name: /^Show .+ in 3D$/ })
const cellsOf = (page: Page, row: string) => designTable(page).getByRole('row', { name: new RegExp(`^${row}`) }).getByRole('cell')
const scene = (page: Page) => page.locator('[data-scene-ready="true"]')
const stepper = (page: Page) => page.locator('[data-rule-step]')
const steps = (page: Page) => page.getByRole('radiogroup', { name: 'Rules that carve the envelope' })
const limitValue = (page: Page, label: string) => rules(page).getByRole('listitem').filter({ hasText: label }).first()

async function markSameDocument(page: Page) {
  await page.evaluate(() => ((window as unknown as { __same: boolean }).__same = true))
}

async function stillSameDocument(page: Page) {
  return page.evaluate(() => (window as unknown as { __same?: boolean }).__same === true)
}

test('shows the rules that apply with their sources, and at least two designs with checklists', async ({ page }) => {
  const errors = await open(page)
  await showTab(page, 'Rules')
  const far = limitValue(page, 'Floor area ratio')
  await expect(far).toContainText('7 : 1')
  await expect(far).toContainText('30,579 m²')
  await far.getByText('Sources (3)').click()
  const link = far.getByRole('link').first()
  await expect(link).toHaveAttribute('href', /\.pdf#page=\d+$/)
  await expect(far).toContainText('Bangkok Comprehensive Plan')
  await expect(far).toContainText(/Page \d+, line \d+/)
  await expect(far).not.toContainText(/[\u0E00-\u0E7F]/)

  const setbacks = rules(page).getByRole('region', { name: 'Setbacks' })
  await expect(setbacks.getByRole('row')).toHaveCount(6)
  await expect(setbacks.getByRole('row', { name: /A–B/ })).toContainText('Road 30 m')
  await expect(rules(page).getByRole('note').filter({ hasText: '2026 plan amendment' })).toBeVisible()
  await expect(rules(page).getByText('Decided', { exact: true }).first()).toBeVisible()
  for (const label of ['Open space ratio', 'Height against road', 'Bangkok building bylaw']) await expect(limitValue(page, label)).toBeVisible()

  await showTab(page, 'Designs')
  expect(await designButtons(page).count()).toBeGreaterThanOrEqual(2)
  await expect(cellsOf(page, 'Checks').first()).toContainText('pass')
  await designsRegion(page).getByRole('button', { name: /^Checklist for / }).click()
  await expect(designsRegion(page).getByText('Floor area within the FAR limit')).toBeVisible()
  await expect(designsRegion(page).getByText(/m² ≤ .*m²/).first()).toBeVisible()
  await expect(designsRegion(page).getByText('Verify on site or with the authority').first()).toBeVisible()
  await page.screenshot({ path: 'e2e/.results/feasibility-1280.png' })
  await designsRegion(page).scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'e2e/.results/feasibility-designs-1280.png' })
  expect(errors).toEqual([])
})

test('updates every panel live when the road width or the building type changes', async ({ page }) => {
  await open(page)
  await markSameDocument(page)
  await showTab(page, 'Rules')
  const setbackRow = rules(page).getByRole('region', { name: 'Setbacks' }).getByRole('row', { name: /A–B/ })
  await expect(setbackRow).toContainText('Road 30 m')
  const heightsBefore = await designsRegion(page).getByText(/^\d+(\.\d)?\sm$/).allTextContents()

  await goTo(page, 'Roads')
  await page.getByLabel('Road width on edge A–B, in metres').fill('8')
  await goTo(page, 'Results')
  await expect(setbackRow).toContainText('Road 8 m')
  await expect.poll(() => designsRegion(page).getByText(/^\d+(\.\d)?\sm$/).allTextContents()).not.toEqual(heightsBefore)
  await expect(rules(page).getByText('Envelope top, high-rise')).toBeHidden()

  await page.getByRole('radio', { name: 'Hotel' }).click()
  await showTab(page, 'Rules')
  await expect(rules(page).getByRole('region', { name: 'Use · Hotel' })).toBeVisible()
  await expect(limitValue(page, 'Rooms')).toContainText('≤ 80')
  await showTab(page, 'Designs')
  await expect(designTable(page)).toContainText('Rooms')
  expect(await stillSameDocument(page)).toBe(true)
})

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 375, height: 812 },
])
  test(`switching the building type changes the results summary in view at ${viewport.width} px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await open(page)
    const summary = page.getByRole('region', { name: 'Results for the design shown in 3D' })
    await expect(summary).toBeInViewport()
    await expect(designsRegion(page)).toContainText('Units')
    const before = await summary.textContent()

    await page.getByRole('radio', { name: 'Office' }).click()
    await expect(designsRegion(page)).toContainText('Net area')
    await expect(summary).not.toHaveText(before!)
    await expect(summary).toBeInViewport()
    await expect(summary).toContainText(/Limited by .+\./)
  })

test('the rule stepper carves the envelope in 3D and on the map, and a chosen design shows in 3D', async ({ page }) => {
  const errors = await open(page)
  await expect(scene(page)).toBeVisible({ timeout: 30_000 })
  await expect(stepper(page)).toHaveAttribute('data-rule-step', 'high-rise')
  const carved = Number(await stepper(page).getAttribute('data-envelope-footprint'))

  await steps(page).getByRole('radio', { name: /Plot/ }).click()
  await expect(stepper(page)).toHaveAttribute('data-rule-step', 'plot')
  const whole = Number(await stepper(page).getAttribute('data-envelope-footprint'))
  expect(whole).toBeGreaterThan(carved)
  await expect(steps(page).getByRole('radio', { name: /Setbacks/ })).toBeDisabled()
  await page.screenshot({ path: 'e2e/.results/feasibility-step-plot.png' })

  await steps(page).getByRole('radio', { name: /Road height/ }).click()
  await expect(stepper(page)).toContainText('steps back')
  await steps(page).getByRole('radio', { name: /High-rise/ }).click()
  await expect(stepper(page)).toHaveAttribute('data-envelope-footprint', String(carved))
  await expect(stepper(page)).toContainText('6 m clear')
  await page.screenshot({ path: 'e2e/.results/feasibility-step-high-rise.png' })

  const second = designButtons(page).nth(1)
  await second.click()
  await expect(second).toHaveAttribute('aria-pressed', 'true')
  const storeys = (await cellsOf(page, 'Storeys').nth(1).textContent())!
  await expect(scene(page)).toHaveAttribute('data-scene-floors', storeys)
  await expect(page.getByRole('application', { name: new RegExp(`Design: ${storeys} floors`) })).toBeVisible()
  expect(errors).toEqual([])
})

async function targets(page: Page) {
  return page.evaluate(() => {
    const visible = [...document.querySelectorAll('aside button:not(:disabled), aside a, aside input[type="text"]')]
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0)
    return {
      scrollW: document.documentElement.scrollWidth,
      scrollH: document.documentElement.scrollHeight,
      smallest: Math.min(...visible.map((r) => r.height)),
    }
  })
}

test('phone layout at 375 px: each panel fits the sheet with 44 px targets', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await open(page)
  for (const tab of ['Rules', 'Designs', '3D'] as const) {
    await showTab(page, tab)
    if (tab === '3D') await expect(scene(page)).toHaveAttribute('data-scene-buildings', /\d+/, { timeout: 30_000 })
    const layout = await targets(page)
    expect(layout.scrollW, `overflow on ${tab}`).toBe(375)
    expect(layout.scrollH, `overflow on ${tab}`).toBe(812)
    expect(layout.smallest, `small target on ${tab}`).toBeGreaterThanOrEqual(44)
    await page.screenshot({ path: `e2e/.results/feasibility-375-${tab.toLowerCase()}.png` })
  }
  await expect(stepper(page)).toBeVisible()
})

test('desktop layout at 1280 px: the plot is fitted clear of the panel and the 3D inset', async ({ page }) => {
  await open(page)
  await expect(scene(page)).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(800)
  const boxes = await page.evaluate(() => {
    const rect = (el: Element | null) => el!.getBoundingClientRect()
    const corners = [...document.querySelectorAll('.map-label-corner')].map((el) => {
      const r = el.getBoundingClientRect()
      return { x: r.left + r.width / 2 - 14, y: r.top + r.height / 2 + 14 }
    })
    return { corners, panel: rect(document.querySelector('aside')), inset: rect(document.querySelector('section[aria-label="3D view"]')) }
  })
  expect(boxes.corners).toHaveLength(5)
  for (const { x, y } of boxes.corners) {
    expect(x).toBeLessThan(boxes.panel.left)
    expect(x > boxes.inset.right || y < boxes.inset.top).toBe(true)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280)
})

test('performance: frame time while dragging a corner with the designs recomputing', async ({ page }) => {
  await open(page)
  await expect(scene(page)).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(800)
  const corner = await page.locator('.map-label-corner', { hasText: 'C' }).boundingBox()
  const [cx, cy] = [corner!.x + corner!.width / 2 - 14, corner!.y + corner!.height / 2 + 14]
  await page.evaluate(() => {
    const w = window as unknown as { __frames: number[]; __long: number }
    w.__frames = []
    w.__long = 0
    new PerformanceObserver((l) => l.getEntries().forEach((e) => (w.__long += e.duration))).observe({ type: 'longtask' })
    const tick = (t: number) => {
      w.__frames.push(t)
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  const before = await designTable(page).textContent()
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  for (let i = 0; i < 40; i++) await page.mouse.move(cx + i * 2, cy - i, { steps: 2 })
  await page.mouse.up()
  await expect.poll(() => designTable(page).textContent()).not.toBe(before)
  const m = await page.evaluate(() => {
    const w = window as unknown as { __frames: number[]; __long: number }
    const f = w.__frames
    const gaps = f.slice(1).map((t, i) => t - f[i]).sort((a, b) => a - b)
    const gl = document.createElement('canvas').getContext('webgl2')
    const dbg = gl?.getExtension('WEBGL_debug_renderer_info')
    return {
      fps: Math.round((f.length - 1) / ((f[f.length - 1] - f[0]) / 1000)),
      p95FrameMs: Math.round(gaps[Math.floor(gaps.length * 0.95)]),
      longTaskMs: Math.round(w.__long),
      renderer: dbg && gl ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : 'unknown',
    }
  })
  console.log(JSON.stringify(m))
  if (!m.renderer.includes('SwiftShader')) {
    expect(m.fps).toBeGreaterThanOrEqual(30)
    expect(m.p95FrameMs).toBeLessThan(50)
  }
})
