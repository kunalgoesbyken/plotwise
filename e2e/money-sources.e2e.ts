import type { Page } from '@playwright/test'
import type { BuildingType, Plot } from '../src/plot/plot'
import { moneyRegion, openResults, showTab } from './support/app'
import { hashOf, mockApp, RESULTS_PLOT } from './support/site'
import { expect, test } from './support/test'

const BOI = /Thailand Board of Investment, Cost of Doing Business in Thailand.*Last Update: March 27th, 2026.*the same baht figures as the 2020 edition/
const RHLB = /RHLB \(Siam\) Ltd\., Construction Commentary, issue July 2025/

const CBD_PLOT: Plot = {
  ...RESULTS_PLOT,
  ring: [
    [100.5435, 13.742],
    [100.5439, 13.742],
    [100.5439, 13.7424],
    [100.5435, 13.7424],
  ],
}

const asUse = (plot: Plot, buildingType: BuildingType): Plot => ({ ...plot, buildingType })

const landRegion = (page: Page) => moneyRegion(page).getByRole('region', { name: 'Land value' })

const rateRow = (page: Page, label: RegExp) => moneyRegion(page).getByRole('listitem').filter({ hasText: label })

const showAssumptions = (page: Page) => moneyRegion(page).getByRole('button', { name: 'All money assumptions' }).click()

async function openMoney(page: Page, plot: Plot) {
  await mockApp(page)
  await openResults(page, hashOf(plot))
  await showTab(page, 'Money')
}

async function sourceOf(page: Page, label: RegExp) {
  const row = rateRow(page, label)
  await row.getByRole('button', { name: 'Source' }).click()
  return row
}

test('money: the office services rate and the basement rate are estimates from the dated BOI construction cost table', async ({ page }) => {
  await openMoney(page, asUse(RESULTS_PLOT, 'office'))
  await showAssumptions(page)
  for (const label of [/^Services/, /^Basement/]) {
    const row = await sourceOf(page, label)
    await expect(row.getByText('Estimated')).toBeVisible()
    await expect(row.getByText(BOI)).toBeVisible()
  }
  await expect(rateRow(page, /^Services/).getByText(/unsourced Plotwise estimates.*a high-rise office totals THB 33,000 to THB 47,000 per m², above both the BOI range/)).toBeVisible()
  await expect(rateRow(page, /^Services/).getByLabel('Low')).toHaveValue('8000')
  await expect(rateRow(page, /^Basement/).getByLabel('High')).toHaveValue('20000')
})

test('money: a rate BOI has no row for says so, stays an unsourced estimate and names the RHLB check', async ({ page }) => {
  await openMoney(page, RESULTS_PLOT)
  await showAssumptions(page)
  const services = await sourceOf(page, /^Services/)
  await expect(services.getByText(/Plotwise estimate, unsourced; the BOI table has no condominium row/)).toBeVisible()
  await expect(services.getByText(RHLB)).toBeVisible()
  const structure = await sourceOf(page, /^Substructure, low-rise/)
  await expect(structure.getByText(/BOI and RHLB publish whole-building rates only/)).toBeVisible()
})

test('money: a CBD condo is priced from CBRE Q3 2026 and the land check quotes the Treasury appraisal as not a market price', async ({ page }) => {
  await openMoney(page, CBD_PLOT)
  const land = landRegion(page)
  await expect(land.getByText(/Priced as central Bangkok \(CBD\)/)).toBeVisible()
  await expect(land.getByLabel('Sale price per m² of saleable area')).toHaveValue('293283')
  await land.getByRole('button', { name: 'Source' }).click()
  await expect(land.getByText(/CBRE Thailand, Bangkok Overall Figures Q3 2026, published 18 November 2026/)).toBeVisible()
  await expect(land.getByText(/Official reference, not a market price, with the road names read from a partly garbled Thai text layer.*the Treasury Department's appraised value for the 2023 to 2026 cycle/)).toBeVisible()
})

test('money: the city fringe keeps Knight Frank and names CBRE for comparison', async ({ page }) => {
  await openMoney(page, RESULTS_PLOT)
  const land = landRegion(page)
  await land.getByRole('button', { name: 'Source' }).click()
  await expect(land.getByText(/Knight Frank Thailand.*For comparison, the asking price of off-plan and under-construction condominium units in CBRE's combined Midtown\/Suburban Bangkok/)).toBeVisible()
})

test('money: an edited BOI-based rate travels in the share link', async ({ page }) => {
  await openMoney(page, asUse(RESULTS_PLOT, 'office'))
  await showAssumptions(page)
  await rateRow(page, /^Services/).getByLabel('Low').fill('9000')
  await expect.poll(() => decodeURIComponent(page.url())).toContain('services.low.office:9000')

  await page.reload()
  await page.locator('[data-map-ready="true"]').waitFor({ timeout: 30_000 })
  await showTab(page, 'Money')
  await showAssumptions(page)
  await expect(rateRow(page, /^Services/).getByLabel('Low')).toHaveValue('9000')
})

test('money: the landing page says which money figures are published and which are Plotwise estimates', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('main').getByRole('button', { name: 'How far can I trust the money figures?', exact: true }).click()
  await expect(page.getByText(/from CBRE in the CBD and Knight Frank elsewhere.*The low-rise office total and the basement build rate follow the Thailand Board of Investment’s cost table/)).toBeVisible()
})
