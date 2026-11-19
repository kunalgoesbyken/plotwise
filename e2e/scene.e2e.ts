import { expect, test, type Page, type Route } from '@playwright/test'
import { encodePlot } from '../src/editor/plot-url'
import type { LngLat } from '../src/geo/projection'
import type { Plot } from '../src/plot/plot'
import fixture from '../src/site/__fixtures__/ratchadaphisek.overpass.json'
import { OverpassResponseSchema } from '../src/site/overpass-response'
import { parseOverpass } from '../src/site/parse'

const recorded = parseOverpass(OverpassResponseSchema.parse(fixture))
const PADDING_DEG = 0.00002

function plotAround(id: string): Plot {
  const outer = recorded.buildings.find((b) => b.id === id)!.outer
  const [west, south] = [Math.min(...outer.map(([lng]) => lng)), Math.min(...outer.map(([, lat]) => lat))]
  const [east, north] = [Math.max(...outer.map(([lng]) => lng)), Math.max(...outer.map(([, lat]) => lat))]
  const ring: LngLat[] = [
    [west - PADDING_DEG, south - PADDING_DEG],
    [east + PADDING_DEG, south - PADDING_DEG],
    [east + PADDING_DEG, north + PADDING_DEG],
    [west - PADDING_DEG, north + PADDING_DEG],
  ]
  return { ring: ring.map(([lng, lat]) => [lng, lat]), roads: [{ edge: 0, widthM: 10 }], buildingType: 'condo', nearStation: false }
}

const ON_A_MAPPED_BLOCK = plotAround('way/601499547')
const OPEN_GROUND: Plot = {
  ring: [
    [100.5626, 13.7650],
    [100.5630, 13.7650],
    [100.5628, 13.7654],
  ],
  roads: [{ edge: 0, widthM: 8 }],
  buildingType: 'office',
  nearStation: false,
}

const fulfilSite = (route: Route) => {
  const bbox = new URL(route.request().url()).searchParams.get('bbox')!.split(',').map(Number)
  return route.fulfill({ json: { bbox, ...recorded, attribution: '© OpenStreetMap contributors (ODbL)' } })
}

async function open(page: Page, plot: Plot) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto(`/#${encodePlot(plot)}`)
  await page.locator('[data-map-ready="true"]').waitFor({ timeout: 30_000 })
  return errors
}

const scene = (page: Page) => page.locator('[data-scene-ready="true"]')
const canvas = (page: Page) => page.getByRole('application', { name: /3D view of the plot/ })

async function sceneCounts(page: Page) {
  return scene(page).evaluate((el: HTMLElement) => ({
    buildings: Number(el.dataset.sceneBuildings),
    hidden: Number(el.dataset.sceneHiddenBuildings),
    roads: Number(el.dataset.sceneRoads),
    corners: Number(el.dataset.scenePlotCorners),
  }))
}

test('shows the plot among the real surrounding buildings and follows a new plot without a reload', async ({ page }) => {
  await page.route('**/api/site?**', fulfilSite)
  const errors = await open(page, ON_A_MAPPED_BLOCK)
  await expect(scene(page)).toBeVisible({ timeout: 30_000 })
  await expect(scene(page)).toHaveAttribute('data-scene-buildings', /\d+/)
  const before = await sceneCounts(page)
  expect(before.hidden).toBeGreaterThanOrEqual(1)
  expect(before.buildings + before.hidden).toBe(recorded.buildings.length)
  expect(before.roads).toBeGreaterThan(0)
  expect(before.corners).toBe(4)
  await expect(canvas(page)).toHaveAttribute('aria-label', new RegExp(`among ${before.buildings} surrounding buildings`))
  await expect(page.getByText('© OpenStreetMap contributors')).toBeVisible()
  await page.screenshot({ path: 'e2e/.results/scene-1280.png' })

  await page.evaluate(() => ((window as unknown as { __sameDocument: boolean }).__sameDocument = true))
  await page.evaluate((hash) => (location.hash = hash), encodePlot(OPEN_GROUND))
  await expect(scene(page)).toHaveAttribute('data-scene-plot-corners', '3')
  await expect(scene(page)).toHaveAttribute('data-scene-hidden-buildings', '0')
  expect(await page.evaluate(() => (window as unknown as { __sameDocument?: boolean }).__sameDocument)).toBe(true)
  expect(errors).toEqual([])
})

test('keeps showing the plot when the surroundings fail, and retries on request', async ({ page }) => {
  let failing = true
  await page.route('**/api/site?**', (route) => (failing ? route.fulfill({ status: 503, json: { error: 'Overpass is busy' } }) : fulfilSite(route)))
  await open(page, ON_A_MAPPED_BLOCK)
  await expect(page.getByText('Surrounding buildings unavailable.')).toBeVisible({ timeout: 30_000 })
  await expect(scene(page)).toHaveAttribute('data-scene-plot-corners', '4')
  await expect(canvas(page)).toHaveAttribute('aria-label', /^3D view of the plot\. Allowed envelope/)
  failing = false
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(scene(page)).toHaveAttribute('data-scene-buildings', /\d+/)
  await expect(page.getByText('Surrounding buildings unavailable.')).toBeHidden()
})

test('phone layout at 375 px: the 3D tab fills the sheet and the view is keyboard reachable', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.route('**/api/site?**', fulfilSite)
  const errors = await open(page, ON_A_MAPPED_BLOCK)
  await page.getByRole('button', { name: '3D', exact: true }).click()
  await expect(scene(page)).toBeVisible({ timeout: 30_000 })
  await expect(scene(page)).toHaveAttribute('data-scene-buildings', /\d+/)
  const box = (await canvas(page).boundingBox())!
  expect(box.width).toBe(375)
  expect(box.height).toBeGreaterThan(250)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375)
  await canvas(page).focus()
  await expect(canvas(page)).toBeFocused()
  await expect(page.getByRole('button', { name: 'Reset view' })).toBeVisible()
  await page.screenshot({ path: 'e2e/.results/scene-375.png' })
  expect(errors).toEqual([])
})

test('performance: frame time while orbiting the 3D view', async ({ page }) => {
  await page.route('**/api/site?**', fulfilSite)
  await open(page, ON_A_MAPPED_BLOCK)
  await expect(scene(page)).toHaveAttribute('data-scene-buildings', /\d+/, { timeout: 30_000 })
  await page.evaluate(() => {
    const w = window as unknown as { __frames: number[] }
    w.__frames = []
    const tick = (t: number) => {
      w.__frames.push(t)
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  const box = (await canvas(page).boundingBox())!
  const [cx, cy] = [box.x + box.width / 2, box.y + box.height / 2]
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  for (let i = 0; i < 60; i++) await page.mouse.move(cx + Math.sin(i / 6) * 150, cy + Math.cos(i / 6) * 60, { steps: 2 })
  await page.mouse.up()
  const m = await page.evaluate(() => {
    const f = (window as unknown as { __frames: number[] }).__frames
    const gaps = f.slice(1).map((t, i) => t - f[i]).sort((a, b) => a - b)
    const gl = document.createElement('canvas').getContext('webgl2')
    const dbg = gl?.getExtension('WEBGL_debug_renderer_info')
    return {
      fps: Math.round((f.length - 1) / ((f[f.length - 1] - f[0]) / 1000)),
      p95FrameMs: Math.round(gaps[Math.floor(gaps.length * 0.95)]),
      renderer: dbg && gl ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : 'unknown',
    }
  })
  console.log(JSON.stringify(m))
  if (!m.renderer.includes('SwiftShader')) {
    expect(m.fps).toBeGreaterThanOrEqual(30)
    expect(m.p95FrameMs).toBeLessThan(50)
  }
})
