import type { Page } from '@playwright/test'
import { designs, headline, purchaseCeiling, rank } from '../src/designs'
import { encodePlot, encodeRegion } from '../src/editor/plot-url'
import { encodePurchase } from '../src/feasibility/purchase-url'
import { MUMBAI_EXAMPLE_PLOT } from '../src/plot/example-plot'
import { REGIONS } from '../src/region/regions'
import { loadPack } from '../src/rules'
import { packInterpretations, solve, withEveryPurchase } from '../src/solve'
import { formatList, formatQuantity } from '../src/text/format'
import { t } from '../src/text/messages'
import { designTable, openResults, summary } from './support/app'
import { mockApp } from './support/site'
import { expect, test } from './support/test'

const pack = loadPack(REGIONS.mum.packId)
const solution = solve(MUMBAI_EXAMPLE_PLOT, pack, packInterpretations(pack))
const options = designs(solution)
const unit = REGIONS.mum.areaUnit

function exampleCeiling() {
  const ceiling = purchaseCeiling(solution, options)
  if (!ceiling) throw new Error('the Mumbai example no longer gains floor area from buying it')
  return ceiling
}

const ceiling = exampleCeiling()

const ceilingLine = t('cap.up-to', {
  area: formatQuantity(ceiling.gfaSqm, unit),
  purchases: formatList(ceiling.purchases.map((kind) => t(`cap.up-to.${kind}`))),
})

const exampleHash = [encodeRegion('mum'), encodePlot(MUMBAI_EXAMPLE_PLOT)].filter(Boolean).join('&')

const everyPurchase = Object.fromEntries(withEveryPurchase(solution).limits.farPurchase.options.map((o) => [o.kind, o.maxExtraGfaSqm / solution.farAreaSqm]))

async function openMumbaiExample(page: Page, hash = exampleHash) {
  await mockApp(page)
  await openResults(page, hash)
}

test('the Mumbai example says how much it could build with every purchase its road width allows, naming each', async ({ page }) => {
  const onOffer = solution.limits.farPurchase.options.filter((option) => option.maxExtraGfaSqm > 0).map((option) => option.kind)
  expect(ceiling.purchases).toEqual(onOffer)
  expect(ceiling.gfaSqm).toBeGreaterThan(headline(options)!.metrics.gfaSqm)
  await openMumbaiExample(page)
  await expect(summary(page).locator('p', { hasText: ceilingLine })).toHaveText(ceilingLine)
})

test('the line goes once everything is bought, and under a design that is not the headline', async ({ page }) => {
  const bought = withEveryPurchase(solution)
  expect(purchaseCeiling(bought, designs(bought))).toBeNull()
  await openMumbaiExample(page, `${exampleHash}&buy-mum=${encodePurchase(everyPurchase)}`)
  await expect(summary(page)).toContainText(t('cap.reached', { area: formatQuantity(bought.farCap.maxGfaSqm, unit) }))
  await expect(summary(page)).not.toContainText(ceilingLine)
  await openMumbaiExample(page)
  const other = rank(options).find(({ standing }) => standing.kind !== 'best')!.design
  await designTable(page).getByRole('button', { name: t('design.show', { name: t('design.name', other.name) }) }).click()
  await expect(summary(page)).not.toContainText(ceilingLine)
})

test('the print summary carries the line', async ({ page }) => {
  await openMumbaiExample(page)
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('article')).toContainText(ceilingLine)
})
