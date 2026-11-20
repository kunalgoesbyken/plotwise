import type { Page } from '@playwright/test'
import { encodePlot, encodeRegion } from '../src/editor/plot-url'
import { DUBAI_EXAMPLE_PLOT, MUMBAI_EXAMPLE_PLOT } from '../src/plot/example-plot'
import { mockApp } from './support/site'
import { designTable, goTo, READY_TIMEOUT, summary } from './support/app'
import { expect, test } from './support/test'

const EXAMPLES = [
  { button: 'Mumbai example', region: 'mum', name: 'Mumbai', plot: MUMBAI_EXAMPLE_PLOT, allowed: '20,118 sq ft', label: 'Draft: DCPR 2034' },
  { button: 'Dubai example', region: 'dxb', name: 'Dubai', plot: DUBAI_EXAMPLE_PLOT, allowed: '78,091 sq ft', label: 'Unverified: from your affection plan' },
] as const

const rulesPicker = (page: Page) => page.getByRole('radiogroup', { name: 'Rules' })

async function expectExampleResults(page: Page, { region, name, plot, allowed, label }: (typeof EXAMPLES)[number]) {
  await expect.poll(() => decodeURIComponent(new URL(page.url()).hash)).toBe(`#${encodeRegion(region)}&${encodePlot(plot)}`)
  await expect(page.getByRole('complementary', { name: 'Plot settings' })).toContainText(name)
  await goTo(page, 'Results')
  await expect(summary(page)).toContainText(allowed, { timeout: READY_TIMEOUT })
  await expect(summary(page)).toContainText(label)
  expect(await designTable(page).getByRole('button', { name: /^Show .+ in 3D$/ }).count()).toBeGreaterThanOrEqual(2)
  await goTo(page, 'Plot')
  await expect(rulesPicker(page).getByRole('radio', { name })).toBeChecked()
}

for (const example of EXAMPLES) {
  test(`the landing’s ${example.button} button opens that region’s example plot with its results`, async ({ page }) => {
    await mockApp(page)
    await page.goto('/')
    await page.getByRole('link', { name: example.button }).click()
    await page.locator('[data-map-ready="true"]').waitFor({ timeout: READY_TIMEOUT })
    await expectExampleResults(page, example)
  })

  test(`the app’s example button under ${example.name} rules opens the ${example.name} example`, async ({ page }) => {
    await mockApp(page)
    await page.goto(`/app#${encodeRegion(example.region)}`)
    await page.locator('[data-map-ready="true"]').waitFor({ timeout: READY_TIMEOUT })
    await page.getByRole('button', { name: 'Try an example plot' }).click()
    await expectExampleResults(page, example)
  })
}

test('the Bangkok example link stays as it was', async ({ page }) => {
  await mockApp(page)
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Try the example plot' }).first()).toHaveAttribute('href', '/app#example')
})
