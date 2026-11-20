import { expect, type Page } from '@playwright/test'
import { decodePlot } from '../../src/editor/plot-url'

export type Device = { readonly name: string; readonly width: number; readonly height: number; readonly isPhone: boolean }

export const DEVICES: readonly Device[] = [
  { name: 'desktop 1440x900', width: 1440, height: 900, isPhone: false },
  { name: 'phone 375x812', width: 375, height: 812, isPhone: true },
]

export type Point = readonly [number, number]

export const DRAWN_PLOT: readonly Point[] = [
  [60, 200],
  [60, 420],
  [190, 300],
  [300, 420],
  [300, 200],
]

const CORNER_LABEL_OFFSET = 14
export const READY_TIMEOUT = 30_000

export const designsRegion = (page: Page) => page.getByRole('tabpanel', { name: 'Designs', includeHidden: true })
export const moneyRegion = (page: Page) => page.getByRole('tabpanel', { name: 'Money', includeHidden: true })
export const rulesRegion = (page: Page) => page.getByRole('tabpanel', { name: 'Rules', includeHidden: true })
export const designTable = (page: Page) => page.getByRole('table', { name: 'Designs compared', includeHidden: true })
export const summary = (page: Page) => page.getByRole('region', { name: 'Results for the design shown in 3D' })
export const zoneCheck = (page: Page) => page.getByRole('region', { name: 'Zone check' })
export const scene = (page: Page) => page.locator('[data-scene-ready="true"]')
export const hashParams = (page: Page) => Object.fromEntries(new URLSearchParams(new URL(page.url()).hash.slice(1)))
export const hint = (page: Page) => page.getByRole('status')
export const frontageWidth = (page: Page, edge: string) => page.getByLabel(`Road width on edge ${edge}, in metres`)
export const showTab = (page: Page, name: 'Designs' | 'Money' | 'Rules' | '3D') => page.getByRole('tab', { name, exact: true }).click()
export const goTo = (page: Page, step: 'Plot' | 'Roads' | 'Results') =>
  page.getByRole('navigation', { name: 'Steps' }).getByRole('button', { name: step }).click()

export async function openApp(page: Page, hash = '') {
  await page.goto(`/app${hash === '' ? '' : `#${hash}`}`)
  await page.locator('[data-map-ready="true"]').waitFor({ timeout: READY_TIMEOUT })
}

export async function openResults(page: Page, hash: string) {
  await openApp(page, hash)
  await expect(designTable(page)).toBeAttached({ timeout: READY_TIMEOUT })
}

export async function drawPlot(page: Page, device: Device, points: readonly Point[] = DRAWN_PLOT) {
  if (device.isPhone) await page.getByRole('button', { name: 'Hide panel' }).click()
  for (const [x, y] of points) await page.mouse.click(x, y)
  await page.mouse.click(points[0][0], points[0][1])
}

export async function settledCorner(page: Page, name: string): Promise<Point> {
  const label = page.locator('.map-label-corner').getByText(name, { exact: true })
  const centre = async () => {
    const box = (await label.boundingBox())!
    return [Math.round(box.x + box.width / 2 - CORNER_LABEL_OFFSET), Math.round(box.y + box.height / 2 + CORNER_LABEL_OFFSET)] as Point
  }
  let last: Point = [Number.NaN, Number.NaN]
  await expect
    .poll(
      async () => {
        const [previous, now] = [last, await centre()]
        last = now
        return now[0] === previous[0] && now[1] === previous[1]
      },
      { intervals: [150] },
    )
    .toBe(true)
  return last
}

export async function dragBy(page: Page, [x, y]: Point, [dx, dy]: Point) {
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y + dy, { steps: 5 })
  await page.mouse.up()
}

export async function plotInUrl(page: Page) {
  await expect.poll(() => new URL(page.url()).hash).toContain('plot=')
  const link = decodePlot(new URL(page.url()).hash)
  return link?.ok ? link.plot : null
}

const areaIn = (text: string) => text.match(/[\d,]+\s?(m²|sq ft)/)![0]

export const buildableText = async (page: Page) => (await summary(page).getByText(/^[\d,]+\s?(m²|sq ft)$/).first().textContent())!

export const allowedText = async (page: Page) => areaIn((await summary(page).getByText(/legal cap/i).first().textContent())!)

export async function allowedArea(page: Page) {
  return Number((await allowedText(page)).replace(/\D/g, ''))
}
