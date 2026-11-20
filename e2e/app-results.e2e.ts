import type { Page } from '@playwright/test'
import {
  DEVICES,
  READY_TIMEOUT,
  allowedArea,
  designTable,
  designsRegion,
  goTo,
  hashParams,
  moneyRegion,
  openResults,
  rulesRegion,
  scene,
  showTab,
  summary,
} from './support/app'
import { RESULTS_PLOT, hashOf, mockApp } from './support/site'
import { expect, test } from './support/test'

const SALE_PRICE = '300000'
const PRINTED_SALE_PRICE = '฿300K'
const NARROWER_ROAD_M = '24'

const landValueRegion = (page: Page) => moneyRegion(page).getByRole('region', { name: 'Land value', includeHidden: true })
const salePrice = (page: Page) => landValueRegion(page).getByLabel('Sale price per m² of saleable area')
const landValue = (page: Page) => landValueRegion(page).getByText(/supports land worth/)
const farBonus = (page: Page) => designsRegion(page).getByRole('switch', { name: /FAR bonus/ })
const buildingType = (page: Page, name: string) => page.getByRole('radio', { name })

async function readState(page: Page) {
  return {
    hash: hashParams(page),
    allowed: await allowedArea(page),
    summary: await summary(page).textContent(),
    designs: await designTable(page).textContent(),
    land: await landValue(page).textContent(),
    salePrice: await salePrice(page).inputValue(),
    office: await buildingType(page, 'Office').isChecked(),
  }
}

for (const device of DEVICES)
  test.describe(`results on ${device.name}`, () => {
    test.use({ viewport: { width: device.width, height: device.height } })

    test.beforeEach(async ({ page }) => {
      await mockApp(page)
      await openResults(page, hashOf(RESULTS_PLOT))
    })

    test('every tab renders its content', async ({ page }) => {
      await expect(page.getByRole('tabpanel', { name: 'Designs' })).toBeVisible()
      expect(await designTable(page).getByRole('button', { name: /^Show .+ in 3D$/ }).count()).toBeGreaterThanOrEqual(2)

      await showTab(page, 'Money')
      await expect(landValueRegion(page)).toBeVisible()

      await showTab(page, 'Rules')
      await expect(rulesRegion(page).getByRole('region', { name: 'Setbacks' })).toBeVisible()
      await expect(rulesRegion(page).getByText('Floor area ratio').first()).toBeVisible()

      if (device.isPhone) await showTab(page, '3D')
      else await expect(page.getByRole('tab', { name: '3D', exact: true })).toBeHidden()
      await expect(scene(page)).toBeVisible({ timeout: READY_TIMEOUT })
      await expect(page.getByRole('application', { name: /3D view of the plot/ })).toBeVisible()
    })

    test('the FAR bonus switch changes the allowed floor area and the designs, and back', async ({ page }) => {
      const standard = { allowed: await allowedArea(page), designs: await designTable(page).textContent() }
      await expect(farBonus(page)).toBeVisible()

      await farBonus(page).click()
      await expect.poll(() => allowedArea(page)).toBeGreaterThan(standard.allowed)
      await expect.poll(() => designTable(page).textContent()).not.toBe(standard.designs)
      expect(hashParams(page).far).toBe('bonus')

      await farBonus(page).click()
      await expect.poll(() => allowedArea(page)).toBe(standard.allowed)
      expect(hashParams(page).far).toBeUndefined()
    })

    test('editing a money assumption updates the land value and travels in the link', async ({ page }) => {
      await showTab(page, 'Money')
      const before = await landValue(page).textContent()
      await salePrice(page).fill(SALE_PRICE)
      await expect(landValue(page)).not.toHaveText(before!)
      expect(hashParams(page).assume).toContain(SALE_PRICE)

      await salePrice(page).fill('')
      await expect(salePrice(page)).toHaveAttribute('aria-invalid', 'true')
      expect(hashParams(page).assume).toContain(SALE_PRICE)
    })

    test('the share link restores the exact state in a new page', async ({ page, context }) => {
      await goTo(page, 'Roads')
      await page.getByLabel('Road width on edge A–B, in metres').fill(NARROWER_ROAD_M)
      await goTo(page, 'Results')
      await buildingType(page, 'Office').click()
      await farBonus(page).click()
      await showTab(page, 'Money')
      await salePrice(page).fill(SALE_PRICE)
      await expect.poll(() => hashParams(page).assume).toBeTruthy()
      await expect.poll(() => hashParams(page).roads).toContain(NARROWER_ROAD_M)
      const shared = await readState(page)
      expect(shared.office).toBe(true)
      expect(shared.hash.far).toBe('bonus')

      const opened = await context.newPage()
      await mockApp(opened)
      await opened.goto(page.url())
      await opened.locator('[data-map-ready="true"]').waitFor({ timeout: READY_TIMEOUT })
      await expect(designTable(opened)).toBeAttached({ timeout: READY_TIMEOUT })
      await showTab(opened, 'Money')
      await expect.poll(async () => (await readState(opened)).salePrice, { timeout: READY_TIMEOUT }).toBe(SALE_PRICE)
      expect(await readState(opened)).toEqual(shared)

      await opened.reload()
      await expect(designTable(opened)).toBeAttached({ timeout: READY_TIMEOUT })
      await showTab(opened, 'Money')
      expect(await readState(opened)).toEqual(shared)
    })

    test('Copy link puts the current address on the clipboard', async ({ page, context }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write'])
      await farBonus(page).click()
      await expect.poll(() => hashParams(page).far).toBe('bonus')
      await summary(page).getByRole('button', { name: 'Copy link' }).click()
      await expect(summary(page).getByRole('button', { name: 'Link copied' })).toBeVisible()
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(page.url())
      await expect(summary(page).getByRole('button', { name: 'Copy link' })).toBeVisible()
    })

    test('the print layout is a summary with the assumptions and the link, and hides the editor', async ({ page }) => {
      await showTab(page, 'Money')
      await salePrice(page).fill(SALE_PRICE)
      await page.emulateMedia({ media: 'print' })
      await expect(page.getByRole('heading', { name: 'Plotwise · Bangkok plot summary' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Assumptions used (estimated, editable)' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Not passed yet' })).toBeVisible()
      await expect(page.getByText(PRINTED_SALE_PRICE)).toBeVisible()
      await expect(page.getByRole('article').getByText('Land value supported, estimated')).toBeVisible()
      await expect(page.getByRole('complementary', { name: 'Plot settings' })).toBeHidden()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(device.width)
    })
  })
