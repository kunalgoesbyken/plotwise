import { expect, test } from '@playwright/test'
import { encodePlot } from '../src/editor/plot-url'
import { EXAMPLE_PLOT } from '../src/plot/example-plot'

test.beforeEach(async ({ page }) => {
  await page.route('**/api/zone?**', (route) => route.fulfill({ json: { status: 'inside', zone: 'brown zone 9 (very high-density residential)' } }))
})

test('the landing page says what Plotwise does and opens the example in the app', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('See what a plot can hold before you buy it')
  await page.getByRole('link', { name: 'Try the example plot' }).first().click()
  await expect(page).toHaveURL(/\/app#plot=/)
  await expect(page.getByRole('table', { name: 'Designs compared', includeHidden: true })).toBeAttached({ timeout: 30_000 })
  expect(errors).toEqual([])
})

test('an old share link on the root opens the plot in the app', async ({ page }) => {
  await page.goto(`/#${encodePlot(EXAMPLE_PLOT)}`)
  await expect(page).toHaveURL(`/app#${encodePlot(EXAMPLE_PLOT)}`)
  await expect(page.getByRole('table', { name: 'Designs compared', includeHidden: true })).toBeAttached({ timeout: 30_000 })
})

for (const width of [375, 1280]) {
  test(`landing layout at ${width} px has no sideways scroll and opens a question`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
    await page.getByRole('button', { name: 'Can I share a result?' }).click()
    await expect(page.getByText('The link holds the plot')).toBeVisible()
  })
}
