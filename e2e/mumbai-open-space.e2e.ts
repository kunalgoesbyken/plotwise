import type { Page } from '@playwright/test'
import { encodePlot, encodeRegion } from '../src/editor/plot-url'
import { localFrame } from '../src/geo/projection'
import type { Plot } from '../src/plot/plot'
import { areaFromDisplay } from '../src/units/area'
import { designsRegion, goTo, READY_TIMEOUT, rulesRegion, showTab, summary } from './support/app'
import { mockApp } from './support/site'
import { expect, test } from './support/test'

const TRANSCRIBED = 'Transcribed from a scanned page, double-checked'
const DRAFT = 'Draft: DCPR 2034'

const frame = localFrame([72.8418, 19.117])
const SIDE_M = Math.sqrt(areaFromDisplay(20_118, 'sqft'))
const LARGE_PLOT: Plot = {
  ring: [
    [0, 0],
    [SIDE_M, 0],
    [SIDE_M, SIDE_M],
    [0, SIDE_M],
  ].map(([x, y]) => frame.toLngLat([x, y]).map((value) => Number(value.toFixed(7))) as [number, number]),
  roads: [
    { edge: 0, widthM: 5 },
    { edge: 1, widthM: 5 },
  ],
  buildingType: 'condo',
  nearStation: false,
}

const sideRear = (page: Page) => rulesRegion(page).getByRole('region', { name: 'Side and rear open space' })
const limitsInLink = (page: Page) => new URLSearchParams(new URL(page.url()).hash.slice(1)).get('limits')

async function open(page: Page, hash: string) {
  await mockApp(page)
  await page.goto(`/app#${hash}`)
  await page.locator('[data-map-ready="true"]').waitFor({ timeout: READY_TIMEOUT })
}

test('the Mumbai example asks for no side and rear open space: Table A comes from the rules', async ({ page }) => {
  await open(page, encodeRegion('mum'))
  await page.getByRole('button', { name: 'Try an example plot' }).click()
  await goTo(page, 'Results')
  await expect(summary(page)).toContainText(DRAFT, { timeout: READY_TIMEOUT })
  await goTo(page, 'Roads')
  await expect(page.getByRole('complementary', { name: 'Plot settings' })).not.toContainText('Side and rear open space')
  await expect(page.getByRole('textbox', { name: /open space|setback/i })).toHaveCount(0)
})

test('the Rules tab lists Table A for the plot’s column, labelled as transcribed from a scanned page', async ({ page }) => {
  await open(page, `${encodeRegion('mum')}&${encodePlot(LARGE_PLOT)}`)
  await expect(summary(page)).toContainText(DRAFT, { timeout: READY_TIMEOUT })
  await showTab(page, 'Rules')
  const group = sideRear(page)
  await expect(group.getByRole('listitem').filter({ hasText: 'Table A column for this plot' })).toContainText('Larger plots')
  const rows = ['Building ≤ 32 m tall', 'Building > 32 m and ≤ 70 m tall', 'Building > 70 m and ≤ 120 m tall', 'Building > 120 m tall']
  const values = ['H/4, at least 3.6 m', 'H/4, at most 12 m', 'H/4, at most 16 m', '20 m']
  for (const [i, label] of rows.entries()) await expect(group.getByRole('listitem').filter({ hasText: label })).toContainText(values[i])
  const first = group.getByRole('listitem').filter({ hasText: rows[0] })
  await first.getByRole('button', { name: /^Sources? / }).click()
  await expect(first.getByText(TRANSCRIBED)).toBeVisible()
  await expect(first.getByText(/^Page 288; line \d+ of the transcription$/).first()).toBeVisible()
  await expect(first.getByText(/^Page 288, line 30$/)).toBeVisible()
})

test('the design checklist passes the side and rear open space against the Table A value, citing the transcription', async ({ page }) => {
  await open(page, `${encodeRegion('mum')}&${encodePlot(LARGE_PLOT)}`)
  await expect(summary(page)).toContainText(DRAFT, { timeout: READY_TIMEOUT })
  await showTab(page, 'Designs')
  await designsRegion(page).getByRole('button', { name: /^Checklist for / }).first().click()
  const check = designsRegion(page).getByRole('listitem').filter({ hasText: 'Setback from neighbours' })
  await expect(check).toContainText('Pass')
  await expect(check).toContainText(/≥ 3\.6 m/)
  await check.getByRole('button', { name: /^Sources? / }).click()
  await expect(check.getByText(TRANSCRIBED).first()).toBeVisible()
})

test('an old Mumbai link that carries a side and rear open space still opens, on Table A, and drops the entry', async ({ page }) => {
  await open(page, `${encodeRegion('mum')}&${encodePlot({ ...LARGE_PLOT, limits: { boundarySetbackM: 6 } })}`)
  await expect(summary(page)).toContainText(DRAFT, { timeout: READY_TIMEOUT })
  await expect.poll(() => limitsInLink(page)).toBeNull()
  await expect(page.getByRole('status')).not.toContainText('not valid')
  await showTab(page, 'Rules')
  await expect(sideRear(page)).toContainText('H/4, at least 3.6 m')
})
