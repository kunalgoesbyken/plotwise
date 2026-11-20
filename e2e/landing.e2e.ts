import { expect, test } from '@playwright/test'
import { encodePlot } from '../src/editor/plot-url'
import { EXAMPLE_PLOT } from '../src/plot/example-plot'
import { BROWN_ZONE, mockZoneStrips } from './zone-layers'

test.beforeEach(async ({ page }) => {
  await mockZoneStrips(page, 'bkk', [{ code: BROWN_ZONE, width: 1 }])
})

test('the landing page says what Plotwise does and opens the example in the app', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('See what a plot can hold before you buy it')
  await page.getByRole('link', { name: 'Try the example plot' }).first().click()
  await expect(page).toHaveURL(/\/app#plot=/)
  await page.getByRole('button', { name: 'See results' }).click()
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

test('the landing and app descriptions name every rules source, with Mumbai as the DCPR 2034 draft', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('main')).toContainText('a draft of Mumbai’s rules read from DCPR 2034 as sanctioned in 2018')
  await page.getByRole('button', { name: 'Does it work outside Bangkok?' }).click()
  await expect(page.getByText('Only Bangkok’s rules are verified.', { exact: false })).toBeVisible()
  await expect(page.getByRole('main')).not.toContainText('Only Bangkok’s rules are read from the law')
  await page.getByRole('link', { name: 'Try the Mumbai draft' }).click()
  await expect(page).toHaveURL(/\/app#rules=mum$/)
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /Mumbai’s rules read from DCPR 2034/)
})
