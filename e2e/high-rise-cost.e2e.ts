import type { Locator, Page } from '@playwright/test'
import { encodePlot, encodeRegion } from '../src/editor/plot-url'
import { exampleFigures } from '../src/landing/example'
import { EXAMPLE_PLOT, MUMBAI_EXAMPLE_PLOT } from '../src/plot/example-plot'
import { formatQuantity } from '../src/text/format'
import { t } from '../src/text/messages'
import { buildableText, openResults, summary } from './support/app'
import { mockApp } from './support/site'
import { expect, test } from './support/test'

const figures = exampleFigures()
const sqm = (value: number) => formatQuantity(value, 'sqm')
const buildable = sqm(figures.buildableSqm)
const name = t('design.name', figures.designName)
const capLine = `Legal cap ${sqm(figures.cap.capSqm)}.`
const costLine = `High-rise rules cost this plot ${sqm(figures.cap.highRiseCostSqm ?? 0)}.`

const fontSize = (locator: Locator) => locator.evaluate((element) => parseFloat(getComputedStyle(element).fontSize))

async function openBangkokExample(page: Page) {
  await mockApp(page)
  await openResults(page, encodePlot(EXAMPLE_PLOT))
}

test('the engine finds that the high-rise rules cost the Bangkok example floor area', () => {
  expect(figures.cap.reached).toBe(false)
  expect(figures.cap.highRiseCostSqm).toBeGreaterThan(0)
})

test('the Bangkok example leads with its largest design’s floor area, then the legal cap and what the high-rise rules cost it', async ({ page }) => {
  await openBangkokExample(page)
  expect(await buildableText(page)).toBe(buildable)
  await expect(summary(page)).toContainText(name)
  await expect(summary(page)).toContainText(`${capLine} ${costLine}`)
  const [figure, cap] = [summary(page).getByText(buildable, { exact: true }), summary(page).getByText(capLine)]
  expect(await fontSize(figure)).toBeGreaterThan(await fontSize(cap))
})

test('a Mumbai example that reaches its cap says so, with no high-rise cost', async ({ page }) => {
  await mockApp(page)
  await openResults(page, [encodeRegion('mum'), encodePlot(MUMBAI_EXAMPLE_PLOT)].filter(Boolean).join('&'))
  await expect(summary(page)).toContainText(`Reaches the legal cap of ${await buildableText(page)}.`)
  await expect(summary(page)).not.toContainText('High-rise rules cost')
})

test('the print summary carries the buildable figure, the cap and the high-rise cost', async ({ page }) => {
  await openBangkokExample(page)
  await page.emulateMedia({ media: 'print' })
  const report = page.getByRole('article')
  await expect(report).toContainText(`${buildable} buildable`)
  await expect(report).toContainText(`${capLine} ${costLine}`)
})

test('the landing page leads with the example’s buildable figure and mentions what the high-rise rules cost it', async ({ page }) => {
  await page.goto('/')
  const caption = page.getByRole('figure').locator('figcaption')
  await expect(caption).toContainText(`${buildable} buildable (${name})`)
  await expect(caption).toContainText(`${capLine} ${costLine}`)
  await expect(page.getByRole('main')).not.toContainText(`up to ${sqm(figures.cap.capSqm)}`)
})

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('the landing hero shows the example’s headline design', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('figure').getByRole('img', { name: `Plotwise showing the example plot on the map, its ${name} in 3D and the results panel` })).toBeVisible()
  })
})
