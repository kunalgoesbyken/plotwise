import { expect, test, type Page } from '@playwright/test'

const widths = [320, 375, 768, 1024, 1280, 1440, 1920, 2560]

async function openReady(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  const start = Date.now()
  await page.goto('/')
  await page.locator('[data-map-ready="true"]').waitFor({ timeout: 30_000 })
  return { errors, readyMs: Date.now() - start }
}

async function layout(page: Page) {
  return page.evaluate(() => {
    const c = document.querySelector('canvas.maplibregl-canvas') as HTMLCanvasElement
    const r = c.getBoundingClientRect()
    const a = document.querySelector('.maplibregl-ctrl-attrib')!.getBoundingClientRect()
    return {
      vw: innerWidth,
      vh: innerHeight,
      scrollW: document.documentElement.scrollWidth,
      scrollH: document.documentElement.scrollHeight,
      canvasW: Math.round(r.width),
      canvasH: Math.round(r.height),
      attribInside: a.right <= innerWidth + 0.5 && a.bottom <= innerHeight + 0.5,
    }
  })
}

test('map loads without errors and its worker is served', async ({ page }) => {
  const worker = page.waitForResponse((r) => r.url().includes('maplibre-gl-worker.mjs'))
  const { errors, readyMs } = await openReady(page)
  expect((await worker).status()).toBe(200)
  expect(errors).toEqual([])
  test.info().annotations.push({ type: 'map ready (ms)', description: String(readyMs) })
})

test('layout fills the viewport at every breakpoint, including after live resize', async ({ page }) => {
  await openReady(page)
  for (const w of widths) {
    await page.setViewportSize({ width: w, height: 900 })
    await expect
      .poll(async () => {
        const l = await layout(page)
        return [l.canvasW, l.canvasH]
      })
      .toEqual([w, 900])
    const l = await layout(page)
    expect(l.scrollW, `horizontal overflow at ${w}`).toBe(w)
    expect(l.scrollH, `vertical overflow at ${w}`).toBe(900)
    expect(l.attribInside, `attribution clipped at ${w}`).toBe(true)
    await page.screenshot({ path: `e2e/.results/resp-${w}.png` })
  }
})

test('performance: frame rate while panning on a 4x slower CPU, heap and long tasks', async ({ page }) => {
  const { readyMs } = await openReady(page)
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
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
  const box = (await page.locator('canvas.maplibregl-canvas').boundingBox())!
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  for (let i = 0; i < 60; i++) await page.mouse.move(cx + Math.sin(i / 6) * 300, cy + Math.cos(i / 6) * 200, { steps: 2 })
  await page.mouse.up()
  const m = await page.evaluate(() => {
    const w = window as unknown as { __frames: number[]; __long: number }
    const f = w.__frames
    const gaps = f.slice(1).map((t, i) => t - f[i]).sort((a, b) => a - b)
    const gl = document.createElement('canvas').getContext('webgl2')
    const dbg = gl?.getExtension('WEBGL_debug_renderer_info')
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
    return {
      fps: Math.round((f.length - 1) / ((f[f.length - 1] - f[0]) / 1000)),
      p95FrameMs: Math.round(gaps[Math.floor(gaps.length * 0.95)]),
      longTaskMs: Math.round(w.__long),
      heapMb: mem ? Math.round(mem.usedJSHeapSize / 1e6) : -1,
      renderer: dbg && gl ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : 'unknown',
    }
  })
  console.log(JSON.stringify({ readyMs, ...m }))
  expect(m.heapMb).toBeLessThan(300)
  if (!m.renderer.includes('SwiftShader')) expect(m.fps).toBeGreaterThanOrEqual(20)
})
