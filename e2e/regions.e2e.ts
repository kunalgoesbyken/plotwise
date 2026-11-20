import { expect, test, type Page } from '@playwright/test'
import { encodePlot, encodeRegion } from '../src/editor/plot-url'
import { localFrame, type LngLat } from '../src/geo/projection'
import type { Plot } from '../src/plot/plot'
import type { RegionId } from '../src/solve'
import { ZONE_SOURCES } from '../src/zone/sources'
import { mockSite, mockZoneInside } from './app-fixtures'

const PHONE = { width: 375, height: 812 }
const DESKTOP = { width: 1280, height: 800 }

function lotAt(origin: LngLat): Plot {
  const frame = localFrame(origin)
  const corners: [number, number][] = [
    [0, 0],
    [40, 0],
    [40, 30],
    [0, 30],
  ]
  const ring = corners.map((corner) => frame.toLngLat(corner).map((value) => Number(value.toFixed(7))) as [number, number])
  return { ring, roads: [{ edge: 0, widthM: 12 }], buildingType: 'condo', nearStation: false }
}

const LONDON = lotAt([-0.1276, 51.5072])
const DUBAI = lotAt([55.2744, 25.1972])

const summary = (page: Page) => page.getByRole('region', { name: 'Results for the design shown in 3D' })
const goTo = (page: Page, step: 'Plot' | 'Roads' | 'Results') => page.getByRole('navigation', { name: 'Steps' }).getByRole('button', { name: step }).click()
const showTab = (page: Page, name: 'Designs' | 'Money' | 'Rules') => page.getByRole('tab', { name, exact: true }).click()
const designsPanel = (page: Page) => page.getByRole('tabpanel', { name: 'Designs', includeHidden: true })
const moneyPanel = (page: Page) => page.getByRole('tabpanel', { name: 'Money', includeHidden: true })
const designTable = (page: Page) => designsPanel(page).getByRole('table', { name: 'Designs compared' })
const rulesPicker = (page: Page) => page.getByRole('radiogroup', { name: 'Rules' })

function collectErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()))
  return errors
}

function watchZoneRequests(page: Page) {
  const requests: string[] = []
  page.on('request', (request) => request.url().startsWith(ZONE_SOURCES.bkk.layer.url) && requests.push(request.url()))
  return requests
}

async function openLink(page: Page, region: RegionId, plot: Plot) {
  await mockSite(page)
  await mockZoneInside(page)
  await page.goto(`/app#${[encodeRegion(region), encodePlot(plot)].filter(Boolean).join('&')}`)
  await page.locator('[data-map-ready="true"]').waitFor({ timeout: 30_000 })
}

async function enterLimit(page: Page, label: string | RegExp, value: string) {
  await page.getByRole('region', { name: /Your rules|From the affection plan/ }).getByLabel(label).fill(value)
}

async function expectSharedLinkReopens(page: Page, label: string) {
  const link = page.url()
  const fresh = await page.context().newPage()
  await mockSite(fresh)
  await fresh.goto(link)
  await fresh.locator('[data-map-ready="true"]').waitFor({ timeout: 30_000 })
  await expect(summary(fresh)).toContainText(label, { timeout: 30_000 })
  await fresh.close()
}

test('an old Bangkok link with no rules key opens unchanged, with the verified rules and no unverified label', async ({ page }) => {
  const errors = collectErrors(page)
  await openLink(page, 'bkk', lotAt([100.5686, 13.7648]))
  await expect(summary(page)).toContainText('of floor area', { timeout: 30_000 })
  await expect(summary(page)).not.toContainText('Unverified')
  await goTo(page, 'Plot')
  await expect(rulesPicker(page).getByRole('radio', { name: 'Bangkok' })).toBeChecked()
  expect(page.url()).not.toContain('rules=')
  expect(errors).toEqual([])
})

test('picking a rules source writes it to the link and back', async ({ page }) => {
  const errors = collectErrors(page)
  await mockSite(page)
  await page.goto('/app')
  await page.locator('[data-map-ready="true"]').waitFor({ timeout: 30_000 })
  await rulesPicker(page).getByRole('radio', { name: 'Dubai' }).click()
  await expect.poll(() => page.url()).toContain('rules=dxb')
  await expect(page.getByText('You enter the limits from the plot’s affection plan.')).toBeVisible()
  await expect(page.getByLabel('Search for an address or place in the Emirate of Dubai')).toBeVisible()
  await rulesPicker(page).getByRole('radio', { name: 'Custom rules' }).click()
  await expect.poll(() => page.url()).toContain('rules=custom')
  await expect(page.getByLabel('Search for an address or place anywhere')).toBeVisible()
  await rulesPicker(page).getByRole('radio', { name: 'Bangkok' }).click()
  await expect.poll(() => page.url()).not.toContain('rules=')
  expect(errors).toEqual([])
})

for (const viewport of [DESKTOP, PHONE]) {
  test(`custom rules anywhere at ${viewport.width} px: enter limits, see designs with pass/fail, unverified, share round-trip`, async ({ page }) => {
    await page.setViewportSize(viewport)
    const errors = collectErrors(page)
    const zoneRequests = watchZoneRequests(page)
    await openLink(page, 'custom', LONDON)
    await expect(page.getByRole('alert').filter({ hasText: 'in the Roads step to continue' })).toBeAttached({ timeout: 30_000 })

    await goTo(page, 'Roads')
    await enterLimit(page, 'Floor area ratio (FAR)', '3')
    await enterLimit(page, 'Maximum storeys', '8')
    await enterLimit(page, 'Maximum ground coverage', '60')
    await enterLimit(page, 'Setback from the road', '3')
    await expect.poll(() => decodeURIComponent(page.url())).toContain('limits=maxFar:3;maxStoreys:8;maxCoverageShare:0.6;roadSetbackM:3')

    await goTo(page, 'Results')
    await expect(summary(page)).toContainText('3,600', { timeout: 30_000 })
    await expect(summary(page)).toContainText('m²')
    await expect(summary(page)).toContainText('Unverified: your own rules')
    expect(await designTable(page).getByRole('button', { name: /^Show .+ in 3D$/ }).count()).toBeGreaterThanOrEqual(2)
    await expect(designsPanel(page).getByText('Unverified: your own rules')).toBeAttached()
    await designsPanel(page).getByRole('button', { name: /^Checklist for / }).click()
    await expect(designsPanel(page).getByText('Floor area within the FAR limit')).toBeAttached()
    await expect(designsPanel(page).getByText(/^Pass$/).first()).toBeAttached()

    await showTab(page, 'Money')
    await expect(moneyPanel(page)).toContainText('Plotwise has no sourced prices or costs for Custom rules')
    await expect(moneyPanel(page).getByLabel('Sale price per m² of saleable area')).toHaveValue('')

    expect(zoneRequests).toEqual([])
    await expectSharedLinkReopens(page, 'Unverified: your own rules')
    expect(errors).toEqual([])
  })
}

for (const viewport of [DESKTOP, PHONE]) {
  test(`Dubai affection plan at ${viewport.width} px: values in sq ft and G+ floors, AED prices, unverified, share round-trip`, async ({ page }) => {
    await page.setViewportSize(viewport)
    const errors = collectErrors(page)
    const zoneRequests = watchZoneRequests(page)
    await openLink(page, 'dxb', DUBAI)
    await goTo(page, 'Roads')
    const plan = page.getByRole('region', { name: 'From the affection plan' })
    await expect(plan.getByLabel('Gross floor area (GFA)')).toBeVisible()
    await expect(plan.getByText('sq ft').first()).toBeVisible()
    await enterLimit(page, 'Gross floor area (GFA)', '32,291')
    await enterLimit(page, 'Floors (G+)', '4')
    await enterLimit(page, 'Setback from neighbour', '3')
    await expect.poll(() => decodeURIComponent(page.url())).toContain('maxStoreys:5')

    await goTo(page, 'Results')
    await expect(summary(page)).toContainText('32,291', { timeout: 30_000 })
    await expect(summary(page)).toContainText('sq ft')
    await expect(summary(page)).toContainText('Unverified: from your affection plan')
    expect(await designTable(page).getByRole('button', { name: /^Show .+ in 3D$/ }).count()).toBeGreaterThanOrEqual(2)

    await showTab(page, 'Money')
    const land = moneyPanel(page).getByRole('region', { name: 'Land value' })
    await expect(land.getByLabel('Sale price per sq ft of saleable area')).toHaveValue('')
    await expect(land.getByText('AED per sq ft')).toBeVisible()
    await land.getByLabel('Sale price per sq ft of saleable area').fill('1500')
    await expect.poll(() => decodeURIComponent(page.url())).toContain('assume-dxb=salePrice.condo:16145')

    expect(zoneRequests).toEqual([])
    await expectSharedLinkReopens(page, 'Unverified: from your affection plan')
    expect(errors).toEqual([])
  })
}

test('the print summary of custom rules carries the unverified label', async ({ page }) => {
  await openLink(page, 'custom', { ...LONDON, limits: { maxGfaSqm: 3000, maxStoreys: 6 } })
  await expect(summary(page)).toContainText('Unverified: your own rules', { timeout: 30_000 })
  await page.emulateMedia({ media: 'print' })
  const report = page.locator('article')
  await expect(report.getByRole('heading', { level: 1, name: 'Plotwise plot summary · Custom rules' })).toBeVisible()
  await expect(report.getByText('Unverified: your own rules')).toBeVisible()
})
