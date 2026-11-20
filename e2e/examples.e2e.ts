import type { Page } from '@playwright/test'
import { edgeName } from '../src/editor/map-features'
import { encodePlot, encodeRegion } from '../src/editor/plot-url'
import { DUBAI_EXAMPLE_PLOT, MUMBAI_EXAMPLE_PLOT } from '../src/plot/example-plot'
import { formatList } from '../src/text/format'
import { t } from '../src/text/messages'
import { mockApp } from './support/site'
import { designsRegion, designTable, frontageWidth, goTo, moneyRegion, READY_TIMEOUT, rulesRegion, showTab, summary } from './support/app'
import { expect, test } from './support/test'

const EXAMPLES = [
  { button: 'Mumbai example', region: 'mum', name: 'Mumbai', plot: MUMBAI_EXAMPLE_PLOT, allowed: '27,781 sq ft', label: 'Draft: DCPR 2034' },
  { button: 'Dubai example', region: 'dxb', name: 'Dubai', plot: DUBAI_EXAMPLE_PLOT, allowed: '7,255 m²', label: 'Unverified: from your affection plan' },
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

async function openExample(page: Page, region: 'mum' | 'dxb') {
  await mockApp(page)
  await page.goto(`/app#${encodeRegion(region)}&example`)
  await page.locator('[data-map-ready="true"]').waitFor({ timeout: READY_TIMEOUT })
  await goTo(page, 'Results')
  await expect(designTable(page)).toBeAttached({ timeout: READY_TIMEOUT })
}

test('the Mumbai example sits on a road estimated at 12 m, marked as an estimate, so Premium FSI and TDR are on offer, with its ASR land rate filled in from the Ready Reckoner', async ({ page }) => {
  await openExample(page, 'mum')
  const buying = designsRegion(page).getByRole('region', { name: 'Extra floor area to buy' })
  await expect(buying.getByRole('slider', { name: 'Premium FSI' })).toBeVisible()
  await expect(buying.getByRole('slider', { name: 'TDR' })).toBeVisible()
  await expect(designsRegion(page)).not.toContainText('None on this road width')
  await showTab(page, 'Rules')
  await expect(rulesRegion(page)).not.toContainText('None on this road width')
  await expect(rulesRegion(page)).toContainText('The road width on A–B and B–C is estimated from OpenStreetMap.')

  await showTab(page, 'Money')
  const land = moneyRegion(page).getByRole('region', { name: 'Land value' })
  await expect(land.getByLabel('ASR land rate per sq ft of land')).toHaveValue('5968.0912896')
  await expect(land.getByText('Example values.')).toBeVisible()
  await expect(land).toContainText('Annual Statement of Rates (Ready Reckoner) 2026-27')
  await expect(land).toContainText('zone 123/567')
  await expect(land).toContainText('easr.igrmaharashtra.gov.in')
  await expect(land).toContainText('matched by position and not confirmed for this plot')

  await goTo(page, 'Roads')
  await expect(frontageWidth(page, 'A–B')).toHaveValue('12')
  await expect(frontageWidth(page, 'A–B')).toHaveAttribute('data-estimated', 'true')
  await expect(frontageWidth(page, 'B–C')).toHaveValue('5')
  await expect(page.getByText('Estimated from OpenStreetMap, check on site.')).toBeVisible()
})

test('the Mumbai example’s roads stay marked as estimated after a reload of its link', async ({ page }) => {
  await openExample(page, 'mum')
  await expect.poll(() => decodeURIComponent(new URL(page.url()).hash)).toBe(`#${encodeRegion('mum')}&${encodePlot(MUMBAI_EXAMPLE_PLOT)}`)
  await page.reload()
  await expect(designTable(page)).toBeAttached({ timeout: READY_TIMEOUT })
  await showTab(page, 'Rules')
  const edges = MUMBAI_EXAMPLE_PLOT.roads.map(({ edge }) => edgeName(edge, MUMBAI_EXAMPLE_PLOT.ring.length))
  await expect(rulesRegion(page)).toContainText(t('rules.estimated-roads', { edges: formatList(edges) }))
})

test('the Mumbai example’s ASR stays the user’s once typed, and is not offered for another plot', async ({ page }) => {
  await openExample(page, 'mum')
  await showTab(page, 'Money')
  const land = moneyRegion(page).getByRole('region', { name: 'Land value' })
  await land.getByLabel('ASR land rate per sq ft of land').fill('6000')
  await expect(land.getByText('Example values.')).toHaveCount(0)
  await expect.poll(() => decodeURIComponent(page.url())).toContain('landRate:')

  await page.goto(`/app#${encodeRegion('mum')}&${encodePlot({ ...MUMBAI_EXAMPLE_PLOT, ring: MUMBAI_EXAMPLE_PLOT.ring.map(([lng, lat]) => [lng + 0.001, lat] as [number, number]) })}`)
  await expect(designTable(page)).toBeAttached({ timeout: READY_TIMEOUT })
  await showTab(page, 'Money')
  await expect(moneyRegion(page).getByText('Example values.')).toHaveCount(0)
})

test('the Dubai example has every limit its affection plan states, so nothing is left to check, and says where those values come from', async ({ page }) => {
  await openExample(page, 'dxb')
  await expect(summary(page)).toContainText('7,255 m²', { timeout: READY_TIMEOUT })
  await expect(designTable(page).getByRole('button', { name: /to check$/ })).toHaveCount(0)
  await goTo(page, 'Roads')
  const plan = page.getByRole('region', { name: 'From the affection plan' })
  await expect(plan.getByLabel('Setback from road')).toHaveValue('0')
  await expect(plan.getByLabel('Setback from neighbour')).toHaveValue('3')
  await expect(plan.getByLabel('Plot coverage')).toHaveValue('60')
  await expect(plan.getByText('Example values.')).toBeVisible()
  await expect(plan).toContainText('IC1-CTYL-16_013')
})

test('the Dubai example shows every area in m², as its affection plan states them, and no sq ft anywhere in the results', async ({ page }) => {
  await openExample(page, 'dxb')
  await expect(summary(page)).toContainText('m²', { timeout: READY_TIMEOUT })
  for (const tab of ['Designs', 'Rules', 'Money'] as const) {
    await showTab(page, tab)
    const shown = { Designs: designsRegion, Rules: rulesRegion, Money: moneyRegion }[tab](page)
    await expect(shown).toContainText('m²')
    await expect(shown).not.toContainText('sq ft')
  }
  await expect(summary(page)).not.toContainText('sq ft')
  await page.emulateMedia({ media: 'print' })
  const report = page.locator('article')
  await expect(report).toContainText('m²')
  await expect(report).not.toContainText('sq ft')
})

test('the Bangkok example link stays as it was', async ({ page }) => {
  await mockApp(page)
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Try the example plot' }).first()).toHaveAttribute('href', '/app#example')
})
