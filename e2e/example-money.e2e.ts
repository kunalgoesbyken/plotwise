import type { Page } from '@playwright/test'
import { encodePlot, encodeRegion } from '../src/editor/plot-url'
import { encodeAssumptions } from '../src/finance/url'
import { formatAmount } from '../src/finance/format-money'
import { MUMBAI_EXAMPLE_PLOT } from '../src/plot/example-plot'
import type { Plot } from '../src/plot/plot'
import { REGIONS } from '../src/region/regions'
import { t } from '../src/text/messages'
import { designsRegion, designTable, goTo, moneyRegion, READY_TIMEOUT, showTab, summary } from './support/app'
import { hashOf, mockApp, RESULTS_PLOT } from './support/site'
import { expect, test } from './support/test'

const MUMBAI = REGIONS.mum
const LOCAL_VALUES_MISSING = 6
const LOSS_MAKING_SALE_PRICE = 5_000
const COST_GUIDES = { mum: 'Construction Cost Guide, India – 2026', dxb: 'Tall buildings construction guide 2026' } as const
const SHELL_AND_CORE_NOTES = { mum: 0, dxb: 1 } as const

const landRegion = (page: Page) => moneyRegion(page).getByRole('region', { name: t('land.title') })
const costRegion = (page: Page) => moneyRegion(page).getByRole('region', { name: t('money.title') })
const fillButton = (page: Page) => landRegion(page).getByRole('button', { name: t('money.fill-examples') })
const salePrice = (page: Page) => landRegion(page).getByLabel(t('land.sale-price', { unit: t('area-unit.sqft'), saleable: MUMBAI.areaTerms.saleable }))
const showAssumptions = (page: Page) => moneyRegion(page).getByRole('button', { name: t('assumptions.all') }).click()
const row = (page: Page, label: string) => moneyRegion(page).getByRole('listitem').filter({ has: page.getByText(label, { exact: true }) })

const movedPlot = (plot: Plot): Plot => ({ ...plot, ring: plot.ring.map(([lng, lat]) => [lng + 0.001, lat] as [number, number]) })

async function openMoney(page: Page, hash: string) {
  await mockApp(page)
  await page.goto(`/app#${hash}`)
  await page.locator('[data-map-ready="true"]').waitFor({ timeout: READY_TIMEOUT })
  await goTo(page, 'Results')
  await showTab(page, 'Money')
}

const landValueRow = (page: Page) => designTable(page).getByRole('row', { includeHidden: true }).filter({ hasText: t('money.land-value') })

for (const region of ['mum', 'dxb'] as const) {
  test(`money: the ${REGIONS[region].name} example opens with example values filled, so its money lines show straight away`, async ({ page }) => {
    await openMoney(page, `${encodeRegion(region)}&example`)
    await expect(costRegion(page)).toBeVisible({ timeout: READY_TIMEOUT })
    await expect(costRegion(page)).toContainText(t('money.first-cost'))
    await expect(landRegion(page).getByText(t('money.examples-applied'))).toBeVisible()
    await expect(landRegion(page).getByText(t('money.shell-and-core'))).toHaveCount(SHELL_AND_CORE_NOTES[region])
    await expect(landRegion(page).getByRole('note')).toHaveCount(0)
    await expect(fillButton(page)).toHaveCount(0)

    await showAssumptions(page)
    await expect(row(page, t('assumptions.margin')).getByText(t('assumptions.generic'), { exact: true })).toBeVisible()
    const rate = row(page, t('assumptions.rate.one-class.substructure.lowRise'))
    await expect(rate.getByText(t('assumptions.split'), { exact: true })).toBeVisible()
    await rate.getByRole('button', { name: t('assumptions.source') }).click()
    await expect(rate).toContainText(COST_GUIDES[region])
    const basement = row(page, t('assumptions.rate.basement', { unit: t(`area-unit.${REGIONS[region].areaUnit}`) }))
    await expect(basement.getByText(t('assumptions.blank'))).toBeVisible()
  })
}

test('money: the Dubai example prices its Jumeirah Village Circle plot with Jumeirah Village Circle sales and supports a land value', async ({ page }) => {
  await openMoney(page, `${encodeRegion('dxb')}&example`)
  await expect(landRegion(page)).toContainText(/supports land worth about AED\s[\d.]+M to AED\s[\d.]+M/, { timeout: READY_TIMEOUT })
  await expect(landRegion(page)).not.toContainText('No land value')
  await expect(page.locator('body')).not.toContainText(/[-−]\s?AED/)
})

test('money: a Dubai sale price that does not cover the sourced costs says so in words and never shows a negative land value', async ({ page }) => {
  const prices = encodeURIComponent(encodeAssumptions({ 'salePrice.condo': LOSS_MAKING_SALE_PRICE })!)
  await openMoney(page, `${encodeRegion('dxb')}&example&assume-dxb=${prices}`)
  const none = /No land value at these prices: costs exceed sales by AED\s[\d.]+M to AED\s[\d.]+M\./
  await expect(landRegion(page)).toContainText(none, { timeout: READY_TIMEOUT })
  await expect(landRegion(page)).not.toContainText('supports land worth')
  await expect(summary(page)).toContainText(none)
  await expect(landValueRow(page).first()).toContainText(none)
  await expect(page.locator('body')).not.toContainText(/(AED\s[\d.]+M) to \1\b/)
  await expect(page.locator('body')).not.toContainText(/[-−]\s?AED/)
})

test('money: on the Mumbai example, buying premium FSI and TDR shows what the extra floor area costs and moves the land value', async ({ page }) => {
  await openMoney(page, `${encodeRegion('mum')}&example`)
  await expect(costRegion(page)).toBeVisible({ timeout: READY_TIMEOUT })
  await expect(costRegion(page).getByText(t('money.purchase'))).toHaveCount(0)
  const before = (await landValueRow(page).textContent()) ?? ''

  await showTab(page, 'Designs')
  const buying = designsRegion(page).getByRole('region', { name: t('purchase.title') })
  await buying.getByLabel(t('purchase.premium')).fill('0.5')
  await expect(landValueRow(page)).not.toHaveText(before)
  const withPremium = (await landValueRow(page).textContent()) ?? ''
  await showTab(page, 'Money')
  await expect(costRegion(page).getByText(t('money.purchase'))).toBeVisible()

  await showTab(page, 'Designs')
  await buying.getByLabel(t('purchase.transferableRights')).fill('0.5')
  await expect(landValueRow(page)).not.toHaveText(withPremium)
})

test('money: a Mumbai plot of your own asks only for its local values, and the button fills them, each with its source', async ({ page }) => {
  await openMoney(page, `${encodeRegion('mum')}&${encodePlot(movedPlot(MUMBAI_EXAMPLE_PLOT))}`)
  await expect(landRegion(page).getByText(t('money.missing', { count: LOCAL_VALUES_MISSING }))).toBeVisible({ timeout: READY_TIMEOUT })
  await expect(salePrice(page)).toHaveValue('')

  await fillButton(page).click()
  await expect(salePrice(page)).toHaveValue(formatAmount(29150))
  await expect(costRegion(page)).toBeVisible()
  await expect(landRegion(page).getByText(t('money.examples-applied'))).toBeVisible()
  await showAssumptions(page)
  const sale = row(page, t('assumptions.salePrice', { unit: t('area-unit.sqft'), saleable: MUMBAI.areaTerms.saleable }))
  await expect(sale.getByText(t('assumptions.example'), { exact: true })).toBeVisible()
  await sale.getByRole('button', { name: t('assumptions.source') }).click()
  await expect(sale).toContainText('squareyards.com')
  const low = row(page, t('assumptions.salePriceLow', { unit: t('area-unit.sqft'), saleable: MUMBAI.areaTerms.saleable }))
  await expect(low.locator('input')).toHaveValue(formatAmount(19100))
  await low.getByRole('button', { name: t('assumptions.source') }).click()
  await expect(low).toContainText('Govt. Reg. Prices')
})

test('money: a value typed over an example value wins, and both travel in the share link', async ({ page }) => {
  await openMoney(page, `${encodeRegion('mum')}&${encodePlot(movedPlot(MUMBAI_EXAMPLE_PLOT))}`)
  await fillButton(page).click()
  await salePrice(page).fill('25000')
  await salePrice(page).blur()
  await expect.poll(() => decodeURIComponent(page.url())).toContain('examples:1')

  await page.reload()
  await page.locator('[data-map-ready="true"]').waitFor({ timeout: READY_TIMEOUT })
  await goTo(page, 'Results')
  await showTab(page, 'Money')
  await expect(salePrice(page)).toHaveValue(formatAmount(25000), { timeout: READY_TIMEOUT })
  await expect(fillButton(page)).toHaveCount(0)
  await showAssumptions(page)
  const sale = row(page, t('assumptions.salePrice', { unit: t('area-unit.sqft'), saleable: MUMBAI.areaTerms.saleable }))
  await expect(sale.getByText(t('money.estimated'), { exact: true })).toBeVisible()
  const low = row(page, t('assumptions.salePriceLow', { unit: t('area-unit.sqft'), saleable: MUMBAI.areaTerms.saleable }))
  await expect(low.locator('input')).toHaveValue(formatAmount(25000))
  await expect(low.getByText(t('money.estimated'), { exact: true })).toBeVisible()
  await expect(row(page, t('assumptions.landReferenceLow')).getByText(t('assumptions.example'), { exact: true })).toBeVisible()
})

test('money: clearing all values on the Mumbai example clears its example values too, and the link keeps them cleared', async ({ page }) => {
  await openMoney(page, `${encodeRegion('mum')}&example`)
  await expect(costRegion(page)).toBeVisible({ timeout: READY_TIMEOUT })
  await showAssumptions(page)
  await moneyRegion(page).getByRole('button', { name: t('assumptions.clear') }).click()
  await expect(landRegion(page).getByText(t('money.missing', { count: LOCAL_VALUES_MISSING }))).toBeVisible()
  await expect(fillButton(page)).toBeVisible()
  await expect.poll(() => decodeURIComponent(page.url())).toContain('examples:0')

  await page.reload()
  await page.locator('[data-map-ready="true"]').waitFor({ timeout: READY_TIMEOUT })
  await goTo(page, 'Results')
  await showTab(page, 'Money')
  await expect(fillButton(page)).toBeVisible({ timeout: READY_TIMEOUT })
})

test('money: Bangkok keeps its own sourced values, with no example button and nothing labelled generic', async ({ page }) => {
  await openMoney(page, hashOf(RESULTS_PLOT))
  await expect(costRegion(page)).toBeVisible({ timeout: READY_TIMEOUT })
  await expect(fillButton(page)).toHaveCount(0)
  await showAssumptions(page)
  await expect(moneyRegion(page).getByText(t('assumptions.generic'), { exact: true })).toHaveCount(0)
  await expect(moneyRegion(page).getByText(t('assumptions.example'), { exact: true })).toHaveCount(0)
  await expect(row(page, t('assumptions.margin')).getByText(t('money.estimated'), { exact: true })).toBeVisible()
})
