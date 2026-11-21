import type { Page } from '@playwright/test'
import { encodePlot, encodeRegion } from '../src/editor/plot-url'
import { MUMBAI_EXAMPLE_PLOT } from '../src/plot/example-plot'
import type { Plot } from '../src/plot/plot'
import { t } from '../src/text/messages'
import { designsRegion, goTo, moneyRegion, openApp, READY_TIMEOUT, showTab } from './support/app'
import { mockApp } from './support/site'
import { expect, test } from './support/test'

const buying = (page: Page) => designsRegion(page).getByRole('region', { name: t('purchase.title') })
const worthLine = (page: Page) => buying(page).getByText(/^Buying .* → /)
const landRegion = (page: Page) => moneyRegion(page).getByRole('region', { name: t('land.title') })

const movedPlot = (plot: Plot): Plot => ({ ...plot, ring: plot.ring.map(([lng, lat]) => [lng + 0.001, lat] as [number, number]) })

async function openMumbai(page: Page, hash: string) {
  await mockApp(page)
  await openApp(page, hash)
  await goTo(page, 'Results')
}

test('the Mumbai example says what buying every premium purchase costs and whether it is worth it, in crore', async ({ page }) => {
  await openMumbai(page, `${encodeRegion('mum')}&example`)
  await expect(worthLine(page)).toContainText('Buying premium FSI, TDR, and fungible area costs ₹', { timeout: READY_TIMEOUT })
  await expect(worthLine(page)).toContainText(/ Cr and lifts the land value by ₹[\d.,]+ Cr to ₹[\d.,]+ Cr after paying for it → worth it at these prices\.$/)
  await expect(worthLine(page)).not.toContainText(/\dM\b/)
})

test('a price that makes the purchases cost more than they add says not worth it', async ({ page }) => {
  await openMumbai(page, `${encodeRegion('mum')}&example`)
  await expect(worthLine(page)).toBeVisible({ timeout: READY_TIMEOUT })
  await showTab(page, 'Money')
  const tdrPrice = landRegion(page).getByLabel(t('land.tdrPrice', { unit: t('area-unit.sqft') }))
  await tdrPrice.fill('5000000')
  await tdrPrice.blur()
  await showTab(page, 'Designs')
  await expect(worthLine(page)).toContainText('→ not worth it at these prices.')
})

test('a Mumbai plot with no prices yet says nothing about whether buying is worth it', async ({ page }) => {
  await openMumbai(page, `${encodeRegion('mum')}&${encodePlot(movedPlot(MUMBAI_EXAMPLE_PLOT))}`)
  await expect(buying(page).getByRole('slider', { name: t('purchase.premium') })).toBeVisible({ timeout: READY_TIMEOUT })
  await expect(worthLine(page)).toHaveCount(0)
})

test('every slider takes its visible label as its accessible name', async ({ page }) => {
  await openMumbai(page, `${encodeRegion('mum')}&example`)
  const sliders = buying(page).getByRole('slider')
  await expect(sliders).toHaveCount(3, { timeout: READY_TIMEOUT })
  const names = ['purchase.premium', 'purchase.transferableRights', 'purchase.fungible'] as const
  for (const [index, name] of names.entries()) await expect(sliders.nth(index)).toHaveAttribute('aria-label', t(name))
})

test('the Mumbai land value reads in crore, not millions', async ({ page }) => {
  await openMumbai(page, `${encodeRegion('mum')}&example`)
  await showTab(page, 'Money')
  await expect(landRegion(page)).toContainText(/land worth about ₹[\d.,]+ Cr to ₹[\d.,]+ Cr\./, { timeout: READY_TIMEOUT })
  await expect(landRegion(page)).not.toContainText(/₹[\d.,]+M/)
})
