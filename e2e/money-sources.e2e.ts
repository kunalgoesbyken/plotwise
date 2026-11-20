import type { Page } from '@playwright/test'
import { localFrame, type LngLat } from '../src/geo/projection'
import type { BuildingType, Plot } from '../src/plot/plot'
import { moneyRegion, openResults, showTab } from './support/app'
import { hashOf, mockApp, RESULTS_PLOT } from './support/site'
import { expect, test } from './support/test'

const BOI = /Thailand Board of Investment, Cost of Doing Business in Thailand.*Last Update: March 27th, 2026/
const RHLB = /RHLB \(Siam\) Ltd\., Construction Commentary, issue July 2025/

function squareAt(origin: LngLat, sideM: number): Plot['ring'] {
  const frame = localFrame(origin)
  const corners: [number, number][] = [
    [0, 0],
    [sideM, 0],
    [sideM, sideM],
    [0, sideM],
  ]
  return corners.map((corner) => frame.toLngLat(corner) as [number, number])
}

const CBD_PLOT: Plot = { ...RESULTS_PLOT, ring: squareAt([100.544, 13.742], 40) }

const asUse = (plot: Plot, buildingType: BuildingType): Plot => ({ ...plot, buildingType })

async function openAssumptions(page: Page, plot: Plot) {
  await mockApp(page)
  await openResults(page, hashOf(plot))
  await showTab(page, 'Money')
  await moneyRegion(page).getByRole('button', { name: 'All money assumptions' }).click()
}

const rateRow = (page: Page, label: RegExp) => moneyRegion(page).getByRole('listitem').filter({ hasText: label })

async function sourceOf(page: Page, label: RegExp) {
  const row = rateRow(page, label)
  await row.getByRole('button', { name: 'Source' }).click()
  return row
}

test('money: the office services rate and the basement rate are estimates from the dated BOI construction cost table', async ({ page }) => {
  await openAssumptions(page, asUse(RESULTS_PLOT, 'office'))
  for (const label of [/^Services/, /^Basement/]) {
    const row = await sourceOf(page, label)
    await expect(row.getByText('Estimated')).toBeVisible()
    await expect(row.getByText(BOI)).toBeVisible()
  }
  await expect(rateRow(page, /^Services/).getByLabel('Low')).toHaveValue('8000')
  await expect(rateRow(page, /^Basement/).getByLabel('High')).toHaveValue('20000')
})

test('money: a rate BOI has no row for says so, stays an unsourced estimate and names the RHLB check', async ({ page }) => {
  await openAssumptions(page, RESULTS_PLOT)
  const services = await sourceOf(page, /^Services/)
  await expect(services.getByText(/Plotwise estimate, unsourced; the BOI table has no condominium row/)).toBeVisible()
  await expect(services.getByText(RHLB)).toBeVisible()
  const structure = await sourceOf(page, /^Substructure, low-rise/)
  await expect(structure.getByText(/BOI and RHLB publish whole-building rates only/)).toBeVisible()
})

test('money: a CBD condo is priced from CBRE Q3 2026 and the land check quotes the Treasury appraisal as not a market price', async ({ page }) => {
  await mockApp(page)
  await openResults(page, hashOf(CBD_PLOT))
  await showTab(page, 'Money')
  const land = moneyRegion(page).getByRole('region', { name: 'Land value' })
  await expect(land.getByText(/Priced as central Bangkok \(CBD\)/)).toBeVisible()
  await expect(land.getByLabel('Sale price per m² of saleable area')).toHaveValue('293283')
  await land.getByRole('button', { name: 'Source' }).click()
  await expect(land.getByText(/CBRE Thailand, Bangkok Overall Figures Q3 2026, published 18 November 2026/)).toBeVisible()
  await expect(land.getByText(/Official reference, not a market price: the Treasury Department's appraised value for the 2023 to 2026 cycle/)).toBeVisible()
})

test('money: the city fringe keeps Knight Frank and names CBRE for comparison', async ({ page }) => {
  await mockApp(page)
  await openResults(page, hashOf(RESULTS_PLOT))
  await showTab(page, 'Money')
  const land = moneyRegion(page).getByRole('region', { name: 'Land value' })
  await land.getByRole('button', { name: 'Source' }).click()
  await expect(land.getByText(/Knight Frank Thailand.*For comparison, the asking price of off-plan and under-construction condominium units in CBRE's combined Midtown\/Suburban Bangkok/)).toBeVisible()
})

test('money: an edited BOI-based rate travels in the share link', async ({ page }) => {
  await openAssumptions(page, asUse(RESULTS_PLOT, 'office'))
  await rateRow(page, /^Services/).getByLabel('Low').fill('9000')
  await expect.poll(() => decodeURIComponent(page.url())).toContain('services.low.office:9000')

  await page.reload()
  await page.locator('[data-map-ready="true"]').waitFor({ timeout: 30_000 })
  await showTab(page, 'Money')
  await moneyRegion(page).getByRole('button', { name: 'All money assumptions' }).click()
  await expect(rateRow(page, /^Services/).getByLabel('Low')).toHaveValue('9000')
})
