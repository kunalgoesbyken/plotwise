import type { Page } from '@playwright/test'
import { rank, type Ranked } from '../src/designs'
import { encodePlot, encodeRegion } from '../src/editor/plot-url'
import { feasibility } from '../src/feasibility/compute'
import { standingLine } from '../src/feasibility/standing-text'
import { DUBAI_EXAMPLE_PLOT, EXAMPLE_PLOT, MUMBAI_EXAMPLE_PLOT } from '../src/plot/example-plot'
import type { Plot } from '../src/plot/plot'
import { REGIONS } from '../src/region/regions'
import { loadPack } from '../src/rules'
import type { RegionId } from '../src/solve'
import { t } from '../src/text/messages'
import { designTable, openResults, scene } from './support/app'
import { mockApp } from './support/site'
import { expect, test } from './support/test'

const EXAMPLES = { bkk: EXAMPLE_PLOT, mum: MUMBAI_EXAMPLE_PLOT, dxb: DUBAI_EXAMPLE_PLOT } satisfies Partial<Record<RegionId, Plot>>

type Example = keyof typeof EXAMPLES

function ranked(region: Example): readonly Ranked[] {
  const result = feasibility(EXAMPLES[region], loadPack(REGIONS[region].packId))
  if (result.status !== 'ready') throw new Error(`the ${region} example does not solve`)
  return rank(result.designs)
}

const nameOf = ({ design }: Ranked) => t('design.name', design.name)
const lineOf = (region: Example, option: Ranked) => standingLine(option, REGIONS[region].areaUnit)
const standings = (page: Page) => page.getByRole('list', { name: t('standing.label') }).getByRole('listitem')
const columnNames = (page: Page) => designTable(page).getByRole('button', { name: /^Show .+ in 3D$/ }).allTextContents()
const background = (page: Page, index: number) => designTable(page).getByRole('columnheader').nth(index).evaluate((cell) => getComputedStyle(cell).backgroundColor)

async function openExample(page: Page, region: Example) {
  await mockApp(page)
  await openResults(page, [encodeRegion(region), encodePlot(EXAMPLES[region])].filter(Boolean).join('&'))
}

async function expectStandings(page: Page, region: Example) {
  const options = ranked(region)
  const shown = options.filter(({ standing }) => standing.kind !== 'same-as')
  expect(await columnNames(page)).toEqual(shown.map(nameOf))
  await expect(standings(page)).toHaveText(options.map((option) => lineOf(region, option)))
  return shown
}

test('the engine greys a Bangkok tower and settles the Mumbai and Dubai ties with what separates the designs', () => {
  for (const region of ['bkk', 'mum', 'dxb'] as const) {
    const options = ranked(region)
    expect(options.filter(({ standing }) => standing.kind === 'best').length).toBe(1)
    expect(options.some(({ standing }) => standing.kind === 'dominated')).toBe(true)
  }
})

test('the Bangkok example marks its headline design as having the most floor area and greys the towers with the reason', async ({ page }) => {
  await openExample(page, 'bkk')
  const shown = await expectStandings(page, 'bkk')
  const best = shown.findIndex(({ standing }) => standing.kind === 'best')
  await expect(standings(page)).toContainText([t('standing.line', { name: nameOf(shown[best]), standing: t('standing.best') })])
  const greyed = shown.findIndex(({ standing }) => standing.kind === 'dominated')
  expect(greyed).toBeGreaterThanOrEqual(0)
  expect(await background(page, greyed)).not.toBe(await background(page, best))
})

test('a greyed design can still be chosen and shown in 3D', async ({ page }) => {
  await openExample(page, 'bkk')
  const greyed = ranked('bkk').find(({ standing }) => standing.kind === 'dominated')!
  const button = designTable(page).getByRole('button', { name: t('design.show', { name: nameOf(greyed) }) })
  await button.focus()
  await page.keyboard.press('Enter')
  await expect(button).toHaveAttribute('aria-pressed', 'true')
  await expect(scene(page)).toHaveAttribute('data-scene-floors', String(greyed.design.metrics.storeys))
})

for (const region of ['mum', 'dxb'] as const)
  test(`the ${REGIONS[region].name} example shows no two designs alike: each design says what separates it, and the table shows it`, async ({ page }) => {
    await openExample(page, region)
    const shown = await expectStandings(page, region)
    const rows = await designTable(page)
      .locator('tbody tr')
      .evaluateAll((trs) => trs.map((tr) => Array.from(tr.querySelectorAll('td'), (cell) => cell.textContent)))
    const columns = shown.map((_, index) => rows.map((cells) => cells[index]).join('|'))
    expect(new Set(columns).size).toBe(shown.length)
  })

test('the print summary lists every design with its mark', async ({ page }) => {
  await openExample(page, 'bkk')
  await page.emulateMedia({ media: 'print' })
  const report = page.getByRole('article')
  for (const option of ranked('bkk')) await expect(report).toContainText(lineOf('bkk', option))
})
