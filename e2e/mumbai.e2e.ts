import { expect, test, type Page } from '@playwright/test'
import { encodePlot, encodeRegion } from '../src/editor/plot-url'
import { encodeAssumptions } from '../src/finance/url'
import { PARAMETERS, storageKey, type Unit } from '../src/finance/parameters'
import { localFrame } from '../src/geo/projection'
import type { Plot } from '../src/plot/plot'
import { mockSite } from './app-fixtures'

const PHONE = { width: 375, height: 812 }
const DESKTOP = { width: 1280, height: 800 }
const DRAFT = 'Draft: DCPR 2034 as sanctioned in 2018; later amendments not applied'

const frame = localFrame([72.8468, 19.1197])
const RING = [
  [0, 0],
  [40, 0],
  [40, 30],
  [0, 30],
].map(([x, y]) => frame.toLngLat([x, y]).map((value) => Number(value.toFixed(7))) as [number, number])
const WIDENED: Plot = { ring: RING, roads: [{ edge: 0, widthM: 9, prescribedWidthM: 18 }], buildingType: 'condo', nearStation: false }

const SAMPLE: Readonly<Record<Unit, number>> = { money: 150_000, landMoney: 2_000_000, share: 0.2, count: 3 }
const enteredValues = (skip: string | null) =>
  encodeAssumptions(Object.fromEntries(PARAMETERS.filter((parameter) => parameter.id !== skip).map((parameter) => [storageKey(parameter, 'condo'), SAMPLE[parameter.unit]])))
const EVERY_VALUE = enteredValues(null)

const summary = (page: Page) => page.getByRole('region', { name: 'Results for the design shown in 3D' })
const goTo = (page: Page, step: 'Plot' | 'Roads' | 'Results') => page.getByRole('navigation', { name: 'Steps' }).getByRole('button', { name: step }).click()
const showTab = (page: Page, name: 'Designs' | 'Money' | 'Rules') => page.getByRole('tab', { name, exact: true }).click()
const panel = (page: Page, name: 'Designs' | 'Money' | 'Rules') => page.getByRole('tabpanel', { name, includeHidden: true })
const buying = (page: Page) => panel(page, 'Designs').getByRole('region', { name: 'Extra floor area to buy' })

function collectErrors(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()))
  return errors
}

async function openApp(page: Page, fragment: string) {
  await mockSite(page)
  await page.goto(`/app#${fragment}`)
  await page.locator('[data-map-ready="true"]').waitFor({ timeout: 30_000 })
}

for (const viewport of [DESKTOP, PHONE]) {
  test(`Mumbai at ${viewport.width} px: import a plot, widen its road, buy premium FSI and TDR, draft label, share round-trip`, async ({ page }) => {
    await page.setViewportSize(viewport)
    const errors = collectErrors(page)
    await openApp(page, '')
    await page.getByRole('radiogroup', { name: 'Rules' }).getByRole('radio', { name: 'Mumbai' }).click()
    await expect.poll(() => page.url()).toContain('rules=mum')
    await expect(page.getByText('A draft read from the law, cited line by line')).toBeVisible()

    await page.getByRole('button', { name: 'Import coordinates or a file' }).click()
    await page.getByLabel('Paste corner coordinates').fill(RING.map(([lng, lat]) => `${lng}, ${lat}`).join('\n'))
    await expect(page.getByText(/^4 corners, [\d,]+\ssq ft$/)).toBeVisible()
    await page.getByRole('button', { name: 'Use this outline' }).click()
    await page.getByRole('button', { name: 'Mark as road, edge A–B' }).click()
    await page.getByLabel('Road width on edge A–B, in metres').fill('9,5')
    await expect(page.getByText('Use a point for decimals, as in 2.5.', { exact: false })).toBeVisible()
    await page.getByLabel('Road width on edge A–B, in metres').fill('9')
    await goTo(page, 'Results')
    await expect(summary(page)).toContainText('12,916', { timeout: 30_000 })
    await expect(summary(page)).toContainText(DRAFT)
    await expect(page.getByRole('radiogroup', { name: 'Building type' }).getByRole('radio')).toHaveCount(1)

    await goTo(page, 'Roads')
    const prescribed = page.getByLabel('Prescribed width of the road on edge A–B, in metres')
    await prescribed.fill('6')
    await expect(prescribed).toHaveAttribute('aria-invalid', 'true')
    await expect(prescribed).toHaveAccessibleDescription('A prescribed width must be wider than the road.')
    await prescribed.fill('18')
    await expect.poll(() => page.url()).toContain('roads=0:9:18')
    await goTo(page, 'Results')
    await expect(summary(page)).toContainText('14,853')

    await showTab(page, 'Designs')
    await buying(page).getByLabel('Premium FSI').fill('0.5')
    await expect(summary(page)).toContainText('20,342')
    await buying(page).getByLabel('TDR').fill('0.9')
    await expect(summary(page)).toContainText('30,223')
    await expect.poll(() => decodeURIComponent(page.url())).toContain('buy-mum=premium:0.5;tdr:0.9')
    expect(await panel(page, 'Designs').getByRole('table', { name: 'Designs compared' }).getByRole('button', { name: /^Show .+ in 3D$/ }).count()).toBeGreaterThanOrEqual(2)
    await expect(panel(page, 'Designs').getByText(DRAFT)).toBeAttached()
    await panel(page, 'Designs').getByRole('button', { name: /^Checklist for / }).first().click()
    await expect(panel(page, 'Designs').getByText('Floor area within the FSI limit')).toBeAttached()
    await expect(panel(page, 'Designs').getByText('Extra floor area bought as the rules allow').first()).toBeAttached()

    await showTab(page, 'Rules')
    await expect(panel(page, 'Rules').getByText(DRAFT)).toBeAttached()
    await expect(panel(page, 'Rules').getByText('Road-widening strip')).toBeAttached()
    await expect(panel(page, 'Rules').getByText('Floor area for the road strip')).toBeAttached()
    await expect(panel(page, 'Rules').getByText('Floor space index', { exact: true })).toBeAttached()
    const rules = panel(page, 'Rules')
    await rules.getByRole('button', { name: /^Sources? / }).first().click()
    await expect(rules.getByRole('link', { name: 'Official text (PDF, in English)' }).first()).toBeVisible()
    await expect(rules.getByText('Official text (PDF, in Thai)')).toHaveCount(0)

    const link = page.url()
    const fresh = await page.context().newPage()
    await mockSite(fresh)
    await fresh.goto(link)
    await expect(summary(fresh)).toContainText('30,223', { timeout: 30_000 })
    await expect(summary(fresh)).toContainText(DRAFT)
    await fresh.close()
    expect(errors).toEqual([])
  })
}

test('Mumbai money: premium asks for the ASR land rate, TDR for its price, and the cost of what is bought shows', async ({ page }) => {
  const errors = collectErrors(page)
  await openApp(page, `${encodeRegion('mum')}&${encodePlot(WIDENED)}&buy-mum=premium:0.5&assume-mum=${EVERY_VALUE}`)
  await expect(summary(page)).toContainText('20,342', { timeout: 30_000 })
  await showTab(page, 'Money')
  const land = panel(page, 'Money').getByRole('region', { name: 'Land value' })
  await expect(land.getByText('1 value still to enter')).toBeVisible()
  await land.getByLabel('ASR land rate per sq ft of land').fill('20000')
  await expect.poll(() => decodeURIComponent(page.url())).toContain('landRate:')
  const money = panel(page, 'Money').getByRole('region', { name: 'Areas and first cost' })
  await expect(money.getByText('Extra floor area bought, estimated')).toBeVisible()
  const before = await money.getByText('Extra floor area bought, estimated').locator('..').textContent()

  await showTab(page, 'Designs')
  await buying(page).getByLabel('TDR').fill('0.5')
  await showTab(page, 'Money')
  await expect(land.getByLabel('TDR price per sq ft of floor area')).toHaveValue('')
  await land.getByLabel('TDR price per sq ft of floor area').fill('5000')
  await expect(money.getByText('Extra floor area bought, estimated').locator('..')).not.toHaveText(before ?? '')

  await showTab(page, 'Designs')
  const bought = panel(page, 'Designs').getByRole('table', { name: 'Designs compared' }).getByRole('row', { name: /Extra floor area bought/ }).getByRole('cell')
  const cells = await bought.allTextContents()
  expect(cells.length).toBeGreaterThanOrEqual(2)
  expect(new Set(cells).size).toBe(cells.length)
  expect(errors).toEqual([])
})

test('Mumbai carpet area starts at built-up area over 1.2 from DCPR 2034, editable, with the stamp-duty 1.1 explained', async ({ page }) => {
  const errors = collectErrors(page)
  await openApp(page, `${encodeRegion('mum')}&${encodePlot(WIDENED)}&assume-mum=${enteredValues('saleableShare')}`)
  await expect(summary(page)).toContainText('Supports land worth', { timeout: 30_000 })
  await showTab(page, 'Money')
  const money = panel(page, 'Money')
  await expect(money.getByText('still to enter')).toHaveCount(0)
  await money.getByRole('button', { name: 'All money assumptions' }).click()
  const share = money.getByLabel('Carpet area as a share of built-up area above parking')
  await expect(share).toHaveValue('83.3333333333')
  await money.getByRole('listitem').filter({ has: page.getByLabel('Carpet area as a share of built-up area above parking') }).getByRole('button', { name: 'Source' }).click()
  await expect(money.getByText(/Reg 15 Note 3/)).toBeAttached()
  await expect(money.getByText(/Ready Reckoner/)).toBeAttached()
  await share.fill('80')
  await expect.poll(() => decodeURIComponent(page.url())).toContain('saleableShare.condo:0.8')
  expect(errors).toEqual([])
})

test('Mumbai names its building type Residential (apartments) and keeps DCPR 2034, Table A in its own capitals', async ({ page }) => {
  const errors = collectErrors(page)
  await openApp(page, `${encodeRegion('mum')}&${encodePlot(WIDENED)}`)
  await expect(summary(page)).toContainText(DRAFT, { timeout: 30_000 })
  const buildingType = page.getByRole('radiogroup', { name: 'Building type' })
  await expect(buildingType.getByRole('radio', { name: 'Residential (apartments)' })).toBeChecked()
  await expect(buildingType).not.toContainText('Condominium')
  await showTab(page, 'Rules')
  await expect(panel(page, 'Rules').getByRole('region', { name: 'Use · Residential (apartments)' })).toBeAttached()
  await goTo(page, 'Roads')
  await expect(page.getByText('Pick the building type above that matches the Residential (R zone), Suburbs and Extended Suburbs on the DCPR 2034, Table A.')).toBeVisible()
  await expect(page.getByRole('complementary', { name: 'Plot settings' })).not.toContainText('dcpr')
  expect(errors).toEqual([])
})

test('the Mumbai print summary carries the draft label', async ({ page }) => {
  await openApp(page, `${encodeRegion('mum')}&${encodePlot(WIDENED)}`)
  await expect(summary(page)).toContainText(DRAFT, { timeout: 30_000 })
  await page.emulateMedia({ media: 'print' })
  const report = page.locator('article')
  await expect(report.getByRole('heading', { level: 1, name: 'Plotwise · Mumbai plot summary' })).toBeVisible()
  await expect(report.getByText(DRAFT)).toBeVisible()
})
