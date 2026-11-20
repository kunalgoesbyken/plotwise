import { chromium, type Locator, type Page } from '@playwright/test'
import { spawnSync } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { encodePlot } from '../src/editor/plot-url'
import { EXAMPLE_PLOT } from '../src/plot/example-plot'

const BASE_URL = process.env.HERO_URL ?? 'http://localhost:3000'
const VIDEO_DIR = 'public/hero'
const POSTER_DIR = 'src/landing'
const FRAMES_DIR = join(tmpdir(), 'plotwise-hero')
const ENCODE_ONLY = process.argv.includes('--encode-only')
const FRAME_RATE = 20
const SCALE = 2
const LAST_FRAME_SECONDS = 1
const ORBIT_PX_PER_SECOND = 90
const GPU_ARGS = ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']

type Variant = {
  readonly name: 'desktop' | 'phone'
  readonly viewport: { readonly width: number; readonly height: number }
  readonly mobile: boolean
  readonly outputWidth: number
  readonly poster: string
  readonly scenario: (page: Page) => Promise<void>
}

type Frame = { readonly file: string; readonly at: number }

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const stepper = (page: Page, step: string) => page.getByRole('navigation', { name: 'Steps' }).getByRole('button', { name: step })
const scene = (page: Page) => page.locator('[data-scene-ready="true"]')
const threeDTab = (page: Page) => page.getByRole('tab', { name: '3D', exact: true })

async function orbit(page: Page, area: Locator, durationMs: number) {
  const box = (await area.boundingBox())!
  const y = box.y + box.height * 0.55
  const from = box.x + box.width * 0.25
  const started = Date.now()
  await page.mouse.move(from, y)
  await page.mouse.down()
  for (let elapsed = 0; elapsed < durationMs; elapsed = Date.now() - started) {
    await page.mouse.move(from + (elapsed / 1000) * ORBIT_PX_PER_SECOND, y)
    await pause(16)
  }
  await page.mouse.up()
}

const showDesign = (page: Page, index: number) => page.getByRole('button', { name: /^Show .+ in 3D$/ }).nth(index).click()

async function desktopScenario(page: Page) {
  await pause(900)
  await page.getByRole('button', { name: 'Try an example plot' }).click()
  await pause(1700)
  await stepper(page, 'Roads').click()
  await pause(1500)
  await stepper(page, 'Results').click()
  await scene(page).waitFor()
  await pause(500)
  await orbit(page, scene(page), 2000)
  await showDesign(page, 1)
  await orbit(page, scene(page), 1700)
  await showDesign(page, 2)
  await orbit(page, scene(page), 1700)
  await showDesign(page, 0)
  await pause(900)
}

async function phoneScenario(page: Page) {
  await pause(900)
  await page.getByRole('button', { name: 'Try an example plot' }).click()
  await pause(1700)
  await stepper(page, 'Roads').click()
  await pause(1500)
  await stepper(page, 'Results').click()
  await pause(1700)
  await threeDTab(page).click()
  await scene(page).waitFor()
  await pause(500)
  await orbit(page, scene(page), 2600)
  await pause(600)
}

const VARIANTS: readonly Variant[] = [
  {
    name: 'desktop',
    viewport: { width: 1440, height: 900 },
    mobile: false,
    outputWidth: 1280,
    poster: join(POSTER_DIR, 'app.png'),
    scenario: desktopScenario,
  },
  {
    name: 'phone',
    viewport: { width: 375, height: 812 },
    mobile: true,
    outputWidth: 640,
    poster: join(POSTER_DIR, 'app-phone.png'),
    scenario: phoneScenario,
  },
]

function runFfmpeg(args: readonly string[]) {
  const result = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' })
  if (result.status !== 0) throw new Error(`ffmpeg failed: ${args.join(' ')}`)
}

async function warmUp(page: Page) {
  await page.goto(`${BASE_URL}/app#${encodePlot(EXAMPLE_PLOT)}`)
  await page.locator('[data-map-ready="true"]').waitFor()
  await page.locator('[data-scene-buildings]').first().waitFor({ state: 'attached', timeout: 60_000 })
  await pause(3000)
}

async function writePoster(page: Page, variant: Variant, dir: string) {
  await stepper(page, 'Results').click()
  if (variant.name === 'phone') await threeDTab(page).click()
  await pause(2500)
  const full = join(dir, 'poster.png')
  await page.screenshot({ path: full, type: 'png' })
  runFfmpeg(['-i', full, '-vf', `scale=${variant.outputWidth}:-2:flags=lanczos`, variant.poster])
}

function frameList(frames: readonly Frame[]) {
  const entries = frames.map(({ file, at }, index) => {
    const next = frames[index + 1]
    return `file '${file}'\nduration ${(next ? next.at - at : LAST_FRAME_SECONDS).toFixed(4)}`
  })
  return [...entries, `file '${frames.at(-1)!.file}'`].join('\n')
}

async function startScreencast(page: Page, variant: Variant, dir: string) {
  const frames: Frame[] = []
  const client = await page.context().newCDPSession(page)
  client.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    const file = `${String(frames.length).padStart(5, '0')}.jpg`
    frames.push({ file, at: metadata.timestamp ?? 0 })
    await writeFile(join(dir, file), Buffer.from(data, 'base64'))
    await client.send('Page.screencastFrameAck', { sessionId })
  })
  await client.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 92,
    maxWidth: variant.viewport.width * SCALE,
    maxHeight: variant.viewport.height * SCALE,
  })
  return async () => {
    await client.send('Page.stopScreencast')
    await pause(300)
    await writeFile(join(dir, 'frames.txt'), frameList(frames))
  }
}

async function record(variant: Variant, dir: string) {
  const browser = await chromium.launch({ channel: 'chromium', args: GPU_ARGS })
  const context = await browser.newContext({
    viewport: variant.viewport,
    deviceScaleFactor: SCALE,
    isMobile: variant.mobile,
    hasTouch: variant.mobile,
    reducedMotion: 'no-preference',
  })
  const page = await context.newPage()
  await page.route('**/api/zone?**', (route) => route.fulfill({ json: { status: 'inside', zone: 'brown zone 9 (very high-density residential)' } }))
  await warmUp(page)
  await writePoster(page, variant, dir)
  await stepper(page, 'Plot').click()
  await page.getByRole('button', { name: 'Clear and redraw' }).click()
  await pause(1500)
  const stop = await startScreencast(page, variant, dir)
  await variant.scenario(page)
  await stop()
  await browser.close()
}

function encode(dir: string, variant: Variant, codecArgs: readonly string[], extension: string) {
  const filter = `fps=${FRAME_RATE},hqdn3d=2:2:5:5,scale=${variant.outputWidth}:-2:flags=lanczos,format=yuv420p`
  runFfmpeg(['-f', 'concat', '-safe', '0', '-i', join(dir, 'frames.txt'), '-vf', filter, ...codecArgs, '-an', join(VIDEO_DIR, `hero-${variant.name}.${extension}`)])
}

const H264 = ['-c:v', 'libx264', '-preset', 'veryslow', '-crf', '30', '-movflags', '+faststart']
const VP9 = ['-c:v', 'libvpx-vp9', '-crf', '40', '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '1']

await mkdir(VIDEO_DIR, { recursive: true })
for (const variant of VARIANTS) {
  const dir = join(FRAMES_DIR, variant.name)
  if (!ENCODE_ONLY) {
    await rm(dir, { recursive: true, force: true })
    await mkdir(dir, { recursive: true })
    await record(variant, dir)
  }
  encode(dir, variant, H264, 'mp4')
  encode(dir, variant, VP9, 'webm')
}
