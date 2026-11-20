import { decodePlot } from '../src/editor/plot-url'
import { designTable, hint, plotInUrl } from './support/app'
import { OLD_EXAMPLE_HASH, mockApp } from './support/site'
import { expect, test } from './support/test'

const FIRST_CORNER = [100.5262, 13.7228]
const OLD_EXAMPLE_CORNERS = 6

test.beforeEach(async ({ page }) => {
  await mockApp(page)
})

test('the old example link on the root forwards to the app and opens its results', async ({ page }) => {
  await page.goto(`/#${OLD_EXAMPLE_HASH}`)
  await expect(page).toHaveURL(`/app#${OLD_EXAMPLE_HASH}`)
  await expect(designTable(page)).toBeAttached({ timeout: 30_000 })
  const plot = await plotInUrl(page)
  expect(plot?.ring).toHaveLength(OLD_EXAMPLE_CORNERS)
  expect(plot?.ring[0]).toEqual(FIRST_CORNER)
  expect(plot?.roads).toEqual([{ edge: 0, widthM: 12 }])
})

test('the old example link opens straight on the app without the zone parameter', async ({ page }) => {
  await page.goto(`/app#${OLD_EXAMPLE_HASH}`)
  await page.locator('[data-map-ready="true"]').waitFor({ timeout: 30_000 })
  await expect(designTable(page)).toBeAttached({ timeout: 30_000 })
  await expect(page.getByRole('region', { name: 'Building type' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Condominium' })).toBeChecked()
})

test('the old link keeps the station switch and parameters it does not know when forwarded', async ({ page }) => {
  await page.goto(`/#${OLD_EXAMPLE_HASH}&station=1&utm_source=newsletter`)
  await expect(page).toHaveURL(/\/app#/)
  await expect(designTable(page)).toBeAttached({ timeout: 30_000 })
  const params = new URLSearchParams(new URL(page.url()).hash.slice(1))
  expect(params.get('utm_source')).toBe('newsletter')
  const decoded = decodePlot(new URL(page.url()).hash)
  expect(decoded?.ok && decoded.plot.nearStation).toBe(true)
})

test('an old link that is not valid still opens the app and says why', async ({ page }) => {
  await page.goto('/#plot=1,2;garbage&roads=0:-1&type=castle')
  await expect(page).toHaveURL(/\/app#/)
  await page.locator('[data-map-ready="true"]').waitFor({ timeout: 30_000 })
  await expect(hint(page)).toContainText('This link’s plot is not valid')
})

test('a root link to a section of the landing page is not forwarded to the app', async ({ page }) => {
  await page.goto('/#faq')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page).toHaveURL(/\/#faq$/)
})
