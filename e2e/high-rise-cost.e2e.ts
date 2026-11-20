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
const capLine = t('cap.legal', { area: sqm(figures.cap.capSqm) })

function exampleCostSqm(): number {
  if (figures.cap.kind !== 'short' || figures.cap.highRiseCostSqm === null) throw new Error('the Bangkok example no longer loses floor area to the high-rise rules')
  return figures.cap.highRiseCostSqm
}

const costLine = t('cap.high-rise-cost', { area: sqm(exampleCostSqm()) })

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

test('the Bangkok example leads with its largest design’s floor area, then the legal cap and what the high-rise rules cost it', async ({ page }) => {
  await openBangkokExample(page)
  expect(await buildableText(page)).toBe(buildable)
  await expect(summary(page)).toContainText(name)
  await expect(summary(page)).toContainText(`${capLine} ${costLine}`)
  const [figure, cap] = [summary(page).getByText(buildable, { exact: true }), summary(page).getByText(capLine)]
  expect(await fontSize(figure)).toBeGreaterThan(await fontSize(cap))
})

test('the high-rise cost shows only under the headline design it is measured against', async ({ page }) => {
  const designs = exampleDesigns()
  const best = headline(designs)!
  const other = designs.find((design) => design.id !== best.id)!
  await openBangkokExample(page)
  await showDesign(page, t('design.name', other.name))
  await expect(summary(page)).toContainText(capLine)
  await expect(summary(page)).not.toContainText(costLine)
  await showDesign(page, t('design.name', best.name))
  await expect(summary(page)).toContainText(`${capLine} ${costLine}`)
})

test('a Mumbai example that reaches its cap says so, with no high-rise cost', async ({ page }) => {
  await mockApp(page)
  await openResults(page, [encodeRegion('mum'), encodePlot(MUMBAI_EXAMPLE_PLOT)].filter(Boolean).join('&'))
  const reached = t('cap.reached', { area: await buildableText(page) })
  await expect(summary(page).locator('p', { hasText: reached })).toHaveText(reached)
})

test('the print summary carries the buildable figure, the cap and the high-rise cost', async ({ page }) => {
  await openBangkokExample(page)
  await page.emulateMedia({ media: 'print' })
  const report = page.getByRole('article')
  await expect(report).toContainText(t('report.buildable', { area: buildable }))
  await expect(report).toContainText(`${capLine} ${costLine}`)
})

test('the landing page leads with the example’s buildable figure and mentions what the high-rise rules cost it', async ({ page }) => {
  await page.goto('/')
  const caption = page.getByRole('figure').locator('figcaption')
  await expect(caption).toContainText(t('landing.frame.meta', { area: sqm(figures.plotSqm), buildable, name }))
  await expect(caption).toContainText(`${capLine} ${costLine}`)
  await expect(page.getByRole('main')).not.toContainText(`up to ${sqm(figures.cap.capSqm)}`)
})

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('the landing hero shows the example’s headline design', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('figure').getByRole('img', { name: t('landing.frame.alt', { name }) })).toBeVisible()
  })
})
