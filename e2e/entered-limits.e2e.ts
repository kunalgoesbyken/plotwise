import type { Page } from '@playwright/test'
import { encodePlot, encodeRegion } from '../src/editor/plot-url'
import { PARAMETERS, storageKey, type Unit } from '../src/finance/parameters'
import { encodeAssumptions } from '../src/finance/url'
import { DUBAI_EXAMPLE_PLOT } from '../src/plot/example-plot'
import type { PlotLimits } from '../src/plot/plot'
import { designTable, goTo, moneyRegion, READY_TIMEOUT, rulesRegion, showTab, summary } from './support/app'
import { mockApp } from './support/site'
import { expect, test } from './support/test'

const SAMPLE: Readonly<Record<Unit, number>> = { money: 5_000, landMoney: 20_000, share: 0.2, count: 3 }
const EVERY_VALUE = encodeAssumptions(Object.fromEntries(PARAMETERS.map((parameter) => [storageKey(parameter, 'condo'), SAMPLE[parameter.unit]])))

const dubaiLink = (limits: PlotLimits, extra = '') => `${encodeRegion('dxb')}&${encodePlot({ ...DUBAI_EXAMPLE_PLOT, limits })}${extra}`

const plan = (page: Page) => page.getByRole('region', { name: 'From the affection plan' })
const areaUnit = (page: Page, unit: 'm²' | 'sq ft') => plan(page).getByRole('radiogroup', { name: 'Areas in' }).getByRole('radio', { name: unit })
const gfa = (page: Page) => plan(page).getByLabel('Gross floor area (GFA)')
const gfaRow = (page: Page) => plan(page).getByRole('listitem').filter({ has: page.getByLabel('Gross floor area (GFA)') })
const alerts = (page: Page) => page.getByRole('main').locator('[role="alert"]')
const limitsInLink = (page: Page) => new URLSearchParams(new URL(page.url()).hash.slice(1)).get('limits')

async function open(page: Page, hash: string) {
  await mockApp(page)
  await page.goto(`/app#${hash}`)
  await page.locator('[data-map-ready="true"]').waitFor({ timeout: READY_TIMEOUT })
}

test('a Dubai GFA is typed in m² by default, can be typed in sq ft, and the link keeps square metres', async ({ page }) => {
  await open(page, dubaiLink({ maxStoreys: 9 }))
  await goTo(page, 'Roads')
  await expect(areaUnit(page, 'm²')).toBeChecked()
  await expect(gfaRow(page)).toContainText('m²')
  await gfa(page).fill('3,000')
  await expect.poll(() => limitsInLink(page)).toBe('maxGfaSqm:3000;maxStoreys:9')
  await expect(summary(page)).toContainText('32,292 sq ft', { timeout: READY_TIMEOUT })

  await gfa(page).blur()
  await areaUnit(page, 'sq ft').click()
  await expect(gfa(page)).toHaveValue('32291.7312501')
  await expect(gfaRow(page)).toContainText('sq ft')
  await gfa(page).fill('10,763.91')
  await expect.poll(() => Math.round(Number(limitsInLink(page)?.match(/maxGfaSqm:([\d.]+)/)?.[1]))).toBe(1000)
  await expect(summary(page)).toContainText('10,764 sq ft', { timeout: READY_TIMEOUT })
})

test('an old Dubai link with a GFA opens on the same square metres, shown in m²', async ({ page }) => {
  await open(page, dubaiLink({ maxGfaSqm: 3000, maxStoreys: 9 }))
  await expect(summary(page)).toContainText('32,292 sq ft', { timeout: READY_TIMEOUT })
  await goTo(page, 'Roads')
  await expect(gfa(page)).toHaveValue('3000')
  expect(limitsInLink(page)).toBe('maxGfaSqm:3000;maxStoreys:9')
})

test('a blank Dubai parking requirement reads Not set in the designs, the Rules tab and the money figures, never 0', async ({ page }) => {
  await open(page, dubaiLink({ maxFar: 3.5, maxStoreys: 9 }, `&assume-dxb=${EVERY_VALUE}`))
  await expect(designTable(page)).toBeAttached({ timeout: READY_TIMEOUT })
  await expect(designTable(page).getByRole('row', { name: 'Parking Not set Not set', exact: true })).toBeAttached()
  await expect(designTable(page).getByRole('row', { name: 'Parking levels Not set Not set', exact: true })).toBeAttached()

  await showTab(page, 'Rules')
  const parking = rulesRegion(page).getByRole('region', { name: 'Parking' })
  await expect(parking).toContainText('Parking requirement')
  await expect(parking).toContainText('Not set')
  await expect(parking).toContainText('Left blank, so the designs carry no parking spaces.')

  await showTab(page, 'Money')
  const money = moneyRegion(page).getByRole('region', { name: 'Areas and first cost' })
  await expect(money.getByRole('definition').filter({ hasText: /^Not set$/ })).toHaveCount(2)
  await expect(money).not.toContainText(/Parking area\s*0/)
})

test('an entered Dubai parking requirement still counts spaces', async ({ page }) => {
  await open(page, dubaiLink({ maxFar: 3.5, maxStoreys: 9, parkingSqmPerSpace: 100 }))
  await expect(designTable(page)).toBeAttached({ timeout: READY_TIMEOUT })
  await expect(designTable(page).getByRole('row', { name: /^Parking \d+ \d+$/ })).toBeAttached()
})

test('a missing height shows one alert, as a button that opens the Roads step', async ({ page }) => {
  await open(page, dubaiLink({ maxFar: 3.5 }))
  const notice = alerts(page).filter({ hasText: 'Enter Building height or Floors for this plot in the Roads step to continue.' })
  await expect(notice).toHaveCount(1, { timeout: READY_TIMEOUT })
  await expect(alerts(page)).toHaveCount(1)
  await notice.getByRole('button').click()
  await expect(page.getByRole('navigation', { name: 'Steps' }).getByRole('button', { name: 'Roads' })).toHaveAttribute('aria-current', 'step')
  await expect(plan(page)).toBeVisible()
  await expect(notice).toHaveCount(1)
  await expect(notice.getByRole('button')).toHaveCount(0)
  await plan(page).getByLabel('Floors').fill('8')
  await expect(alerts(page)).toHaveCount(0)
  await expect(summary(page)).toContainText('78,091 sq ft', { timeout: READY_TIMEOUT })
})
