import type { Locator, Page } from '@playwright/test'
import { encodePlot, exampleFragment } from '../src/editor/plot-url'
import { MAX_ASKING_PRICE } from '../src/finance/asking-price'
import { rangeText } from '../src/finance/figures'
import { landUnitsOf, financeSite } from '../src/finance/estimate'
import { formatAmount, formatMoney } from '../src/finance/format-money'
import { feasibility } from '../src/feasibility/compute'
import { encodeAssumptions } from '../src/finance/url'
import { exampleFigures } from '../src/landing/example'
import { EXAMPLE_PLOT } from '../src/plot/example-plot'
import { loadPack } from '../src/rules'
import { MONEY_REGIONS } from '../src/solve'
import { t } from '../src/text/messages'
import { openExample } from './app-fixtures'
import { READY_TIMEOUT, designTable, goTo, hashParams, moneyRegion, openApp, openResults, showTab, summary } from './support/app'
import { mockApp } from './support/site'
import { expect, test } from './support/test'

const { landValue, currency } = exampleFigures()
const money = (value: number) => formatMoney(value, currency)

const WITHIN = Math.round((landValue.low + landValue.high) / 2)
const OVER = Math.round(landValue.high * 1.25)
const UNDER = Math.round(landValue.low * 0.75)

const WITHIN_TEXT = `Asking ${money(WITHIN)} → within range.`
const OVER_TEXT = `Asking ${money(OVER)} → ${money(OVER - landValue.high)} over.`
const UNDER_TEXT = `Asking ${money(UNDER)} → ${money(landValue.low - UNDER)} under.`

const INVALID_TEXT = `Enter a price above zero, up to ${money(MAX_ASKING_PRICE)}, or leave it blank.`

const LOSS_MAKING_SALE_PRICE = 1_000

const MUMBAI_ASKING = 500_000_000

const PER_WAH = 250_000

function exampleLandUnits() {
  const result = feasibility(EXAMPLE_PLOT, loadPack('bkk-y9'))
  if (result.status !== 'ready') throw new Error('the Bangkok example does not solve')
  return landUnitsOf(financeSite(result.solution, MONEY_REGIONS.bkk))
}

const EXAMPLE_LAND_UNITS = exampleLandUnits()

const askingField = (page: Page) => summary(page).getByLabel('Asking price')
const caretOf = (field: Locator) => field.evaluate((input: HTMLInputElement) => input.selectionStart)
const verdict = (page: Page) => summary(page).getByText(/^Asking .+ →/)
const landValueRegion = (page: Page) => moneyRegion(page).getByRole('region', { name: 'Land value' })
const moneyAskingField = (page: Page) => landValueRegion(page).getByLabel('Asking price')
const basisChoice = (page: Page, name: string) => landValueRegion(page).getByRole('radiogroup', { name: t('asking.basis') }).getByRole('radio', { name })
const totalChoice = (page: Page) => basisChoice(page, t('asking.total'))
const perLandUnit = (page: Page) => basisChoice(page, t('asking.per-land-unit', { unit: MONEY_REGIONS.bkk.landUnit.name }))

test.describe('the Bangkok example', () => {
  test.beforeEach(async ({ page }) => {
    await openExample(page)
    await expect(summary(page)).toContainText(`Supports land worth about ${rangeText(landValue, currency)}`, { timeout: READY_TIMEOUT })
  })

  test('an asking price inside the supported range is within range, in the summary and the Money tab', async ({ page }) => {
    await askingField(page).fill(String(WITHIN))
    await expect(verdict(page)).toHaveText(WITHIN_TEXT)
    await showTab(page, 'Money')
    await expect(landValueRegion(page)).toContainText(WITHIN_TEXT)
  })

  test('an asking price above the range says by how much it is over', async ({ page }) => {
    await askingField(page).fill(String(OVER))
    await expect(verdict(page)).toHaveText(OVER_TEXT)
  })

  test('an asking price below the range says by how much it is under', async ({ page }) => {
    await askingField(page).fill(String(UNDER))
    await expect(verdict(page)).toHaveText(UNDER_TEXT)
  })

  test('the asking price travels in the share link and comes back in a new page', async ({ page, context }) => {
    await askingField(page).fill(String(OVER))
    await expect.poll(() => hashParams(page).ask).toBe(String(OVER))

    const opened = await context.newPage()
    await mockApp(opened)
    await opened.goto(page.url())
    await expect(designTable(opened)).toBeAttached({ timeout: READY_TIMEOUT })
    await expect(askingField(opened)).toHaveValue(formatAmount(OVER))
    await expect(verdict(opened)).toHaveText(OVER_TEXT)
  })

  test('a blank asking price shows no verdict and leaves the link', async ({ page }) => {
    await expect(verdict(page)).toHaveCount(0)
    await askingField(page).fill(String(WITHIN))
    await expect(verdict(page)).toHaveText(WITHIN_TEXT)

    await askingField(page).fill('')
    await expect(verdict(page)).toHaveCount(0)
    await expect.poll(() => hashParams(page).ask).toBeUndefined()
  })

  test('a zero or too large asking price says what to enter, keeps saying it after leaving the field, and keeps the last price in the link', async ({ page }) => {
    await askingField(page).fill(String(WITHIN))
    await expect(verdict(page)).toHaveText(WITHIN_TEXT)

    for (const entry of [0, MAX_ASKING_PRICE * 2]) {
      await askingField(page).fill(String(entry))
      await expect(askingField(page)).toHaveAttribute('aria-invalid', 'true')
      await expect(summary(page).getByText(INVALID_TEXT)).toBeVisible()
      await expect(verdict(page)).toHaveCount(0)
      await askingField(page).blur()
      await expect(askingField(page)).toHaveValue(formatAmount(entry))
      await expect(summary(page).getByText(INVALID_TEXT)).toBeVisible()
      expect(hashParams(page).ask).toBe(String(WITHIN))
    }
  })

  test('the asking price shows thousands separators while it is typed, and a digit typed inside keeps the caret after it', async ({ page }) => {
    const field = askingField(page)
    await field.pressSequentially(String(OVER))
    await expect(field).toHaveValue(formatAmount(OVER))
    expect(await caretOf(field)).toBe(formatAmount(OVER).length)
    await expect.poll(() => hashParams(page).ask).toBe(String(OVER))

    await field.evaluate((input: HTMLInputElement) => input.setSelectionRange(1, 1))
    await field.press('1')
    const edited = Number(`${String(OVER)[0]}1${String(OVER).slice(1)}`)
    await expect(field).toHaveValue(formatAmount(edited))
    expect(await caretOf(field)).toBe(formatAmount(edited).indexOf('1', 1) + 1)
    await expect.poll(() => hashParams(page).ask).toBe(String(edited))
  })

  test('in the Money tab a price per square wah is read against the plot’s area and shared as the total, which comes back per square wah too', async ({ page, context }) => {
    const total = PER_WAH * EXAMPLE_LAND_UNITS
    await showTab(page, 'Money')
    await perLandUnit(page).click()
    await moneyAskingField(page).fill(String(PER_WAH))
    await expect(landValueRegion(page)).toContainText(`Asking ${money(total)} →`)
    await expect.poll(() => hashParams(page).ask).toBe(String(total))
    await moneyAskingField(page).blur()
    await expect(moneyAskingField(page)).toHaveValue(formatAmount(PER_WAH))
    await expect(askingField(page)).toHaveValue(formatAmount(total))

    await totalChoice(page).click()
    await expect(moneyAskingField(page)).toHaveValue(formatAmount(total))

    const opened = await context.newPage()
    await mockApp(opened)
    await opened.goto(page.url())
    await expect(designTable(opened)).toBeAttached({ timeout: READY_TIMEOUT })
    await showTab(opened, 'Money')
    await expect(totalChoice(opened)).toHaveAttribute('aria-checked', 'true')
    await expect(moneyAskingField(opened)).toHaveValue(formatAmount(total))
    await perLandUnit(opened).click()
    await expect(moneyAskingField(opened)).toHaveValue(formatAmount(PER_WAH))
  })

  test('the print summary shows the verdict', async ({ page }) => {
    await askingField(page).fill(String(OVER))
    await expect(verdict(page)).toHaveText(OVER_TEXT)
    await page.emulateMedia({ media: 'print' })
    await expect(page.getByRole('article').getByText(OVER_TEXT)).toBeVisible()
  })
})

test('a design that supports no land value at the entered prices says the asking price is too high, not a margin', async ({ page }) => {
  await mockApp(page)
  const prices = encodeURIComponent(encodeAssumptions({ 'salePrice.condo': LOSS_MAKING_SALE_PRICE })!)
  await openResults(page, `${encodePlot(EXAMPLE_PLOT)}&assume=${prices}&ask=${WITHIN}`)
  await expect(verdict(page)).toHaveText(`Asking ${money(WITHIN)} → too high: at these prices and costs this design supports no land value.`, {
    timeout: READY_TIMEOUT,
  })
})

test('without sourced prices the Money tab says why there is no verdict instead of a number', async ({ page }) => {
  await mockApp(page)
  await openApp(page, `${exampleFragment('mum')}&ask-mum=${MUMBAI_ASKING}`)
  await goTo(page, 'Results')
  await showTab(page, 'Money')
  const asking = formatMoney(MUMBAI_ASKING, MONEY_REGIONS.mum.currency)
  await expect(landValueRegion(page)).toContainText(`Asking ${asking} → no verdict until every money value is entered.`)
  await expect(landValueRegion(page).getByLabel('Asking price')).toHaveValue(formatAmount(MUMBAI_ASKING))
})

test('outside Bangkok the asking price is still entered as a total by default and shared as typed', async ({ page }) => {
  await mockApp(page)
  await openApp(page, exampleFragment('mum'))
  await goTo(page, 'Results')
  await showTab(page, 'Money')
  const land = landValueRegion(page)
  await expect(land.getByRole('radio', { name: t('asking.total') })).toHaveAttribute('aria-checked', 'true')
  await land.getByLabel('Asking price').fill(String(MUMBAI_ASKING))
  await expect(land.getByLabel('Asking price')).toHaveValue(formatAmount(MUMBAI_ASKING))
  await expect.poll(() => hashParams(page)['ask-mum']).toBe(String(MUMBAI_ASKING))
})
