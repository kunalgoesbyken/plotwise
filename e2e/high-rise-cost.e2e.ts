import type { Locator, Page } from '@playwright/test'
import { headline } from '../src/designs'
import { encodePlot, encodeRegion } from '../src/editor/plot-url'
import { feasibility } from '../src/feasibility/compute'
import { exampleFigures } from '../src/landing/example'
import { EXAMPLE_PLOT, MUMBAI_EXAMPLE_PLOT } from '../src/plot/example-plot'
import { DEFAULT_REGION } from '../src/region/regions'
import { loadPack } from '../src/rules'
import { formatQuantity } from '../src/text/format'
import { t } from '../src/text/messages'
import { buildableText, designTable, openResults, summary } from './support/app'
import { mockApp } from './support/site'
import { expect, test } from './support/test'

const figures = exampleFigures()
const sqm = (value: number) => formatQuantity(value, 'sqm')
const buildable = sqm(figures.buildableSqm)
const name = t('design.name', figures.designName)
const capOnly = t('cap.legal', { area: sqm(figures.cap.capSqm) })

function exampleSteps() {
  const { cap } = figures
  if (cap.kind !== 'short' || cap.losses.length !== 2) throw new Error('the Bangkok example no longer loses floor area to both the other limits and the high-rise rules')
  return cap
}

const steps = exampleSteps()

const breakdown = t('cap.steps', {
  cap: sqm(steps.capSqm),
  losses: steps.losses.map((loss) => t('cap.loss', { limiter: t(`limiter.${loss.limitedBy}`), area: sqm(loss.sqm) })),
  buildable: sqm(steps.buildableSqm),
})

const STEP = ' → '

const wholeNumber = (text: string) => Number(text.replace(/\D/g, ''))

function exampleDesigns() {
  const result = feasibility(EXAMPLE_PLOT, loadPack(DEFAULT_REGION.packId))
  if (result.status !== 'ready') throw new Error('the Bangkok example no longer solves')
  return result.designs
}

const fontSize = (locator: Locator) => locator.evaluate((element) => parseFloat(getComputedStyle(element).fontSize))

const showDesign = (page: Page, design: string) => designTable(page).getByRole('button', { name: t('design.show', { name: design }) }).click()

async function openBangkokExample(page: Page) {
  await mockApp(page)
  await openResults(page, encodePlot(EXAMPLE_PLOT))
}

test('the Bangkok example leads with its largest design’s floor area, then every step from the legal cap down to it', async ({ page }) => {
  await openBangkokExample(page)
  expect(await buildableText(page)).toBe(buildable)
  await expect(summary(page)).toContainText(name)
  const line = summary(page).locator('p', { hasText: breakdown })
  await expect(line).toHaveText(breakdown)
  expect(await fontSize(summary(page).getByText(buildable, { exact: true }))).toBeGreaterThan(await fontSize(line))
})

test('the steps shown in the Bangkok summary add up: the cap less what each limit takes is the buildable figure', async ({ page }) => {
  await openBangkokExample(page)
  const shown = (await summary(page).locator('p', { hasText: breakdown }).textContent())!.split(STEP).map(wholeNumber)
  const [cap, ...rest] = shown
  const built = rest.at(-1)!
  const taken = rest.slice(0, -1)
  expect(taken.length).toBe(2)
  expect(cap - taken.reduce((sum, area) => sum + area, 0)).toBe(built)
  expect(built).toBe(wholeNumber(buildable))
})

test('the steps show only under the headline design they are measured against', async ({ page }) => {
  const designs = exampleDesigns()
  const best = headline(designs)!
  const other = designs.find((design) => design.id !== best.id)!
  await openBangkokExample(page)
  await showDesign(page, t('design.name', other.name))
  await expect(summary(page)).toContainText(capOnly)
  await expect(summary(page)).not.toContainText(breakdown)
  await showDesign(page, t('design.name', best.name))
  await expect(summary(page)).toContainText(breakdown)
})

test('a Mumbai example that reaches its cap says so, with no steps', async ({ page }) => {
  await mockApp(page)
  await openResults(page, [encodeRegion('mum'), encodePlot(MUMBAI_EXAMPLE_PLOT)].filter(Boolean).join('&'))
  const reached = t('cap.reached', { area: await buildableText(page) })
  await expect(summary(page).locator('p', { hasText: reached })).toHaveText(reached)
})

test('the print summary carries the buildable figure and the steps from the cap', async ({ page }) => {
  await openBangkokExample(page)
  await page.emulateMedia({ media: 'print' })
  const report = page.getByRole('article')
  await expect(report).toContainText(t('report.buildable', { area: buildable }))
  await expect(report).toContainText(breakdown)
})

test('the landing page leads with the example’s buildable figure and the steps from the cap', async ({ page }) => {
  await page.goto('/')
  const caption = page.getByRole('figure').locator('figcaption')
  await expect(caption).toContainText(t('landing.frame.meta', { area: sqm(figures.plotSqm), buildable, name }))
  await expect(caption).toContainText(breakdown)
  await expect(page.getByRole('main')).not.toContainText(`up to ${sqm(figures.cap.capSqm)}`)
})

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('the landing hero shows the example’s headline design', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('figure').getByRole('img', { name: t('landing.frame.alt', { name }) })).toBeVisible()
  })
})
