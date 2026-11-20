import type { Page } from '@playwright/test'
import { encodePlot, encodeRegion } from '../src/editor/plot-url'
import { localFrame, type LngLat } from '../src/geo/projection'
import { EXAMPLE_PLOT } from '../src/plot/example-plot'
import type { Plot } from '../src/plot/plot'
import type { RegionId } from '../src/solve'
import { SQM_PER_SQFT } from '../src/units/area'
import { designTable, openResults, scene, summary } from './support/app'
import { mockApp } from './support/site'
import { expect, test } from './support/test'

const MUMBAI_PLOT_SQFT = 20_118

function rectangleAt(origin: LngLat, widthM: number, depthM: number): Plot['ring'] {
  const frame = localFrame(origin)
  const corners: [number, number][] = [
    [0, 0],
    [widthM, 0],
    [widthM, depthM],
    [0, depthM],
  ]
  return corners.map((corner) => frame.toLngLat(corner) as [number, number])
}

const side = Math.sqrt(MUMBAI_PLOT_SQFT * SQM_PER_SQFT)
const MUMBAI: Plot = {
  ring: rectangleAt([72.8468, 19.1197], side, side),
  roads: [
    { edge: 0, widthM: 5 },
    { edge: 1, widthM: 5 },
  ],
  buildingType: 'condo',
  nearStation: false,
}
const DUBAI: Plot = {
  ring: rectangleAt([55.2744, 25.1972], 40, 30),
  roads: [{ edge: 0, widthM: 12 }],
  buildingType: 'condo',
  nearStation: false,
  limits: { maxFar: 3.5, maxStoreys: 9 },
}

const cells = (page: Page, row: string) => designTable(page).getByRole('row', { name: new RegExp(`^${row}`) }).getByRole('cell')
const numberIn = (text: string) => Number(text.replace(/[^\d.]/g, ''))

type Column = { readonly name: string; readonly area: string; readonly heightM: number; readonly limitedBy: string; readonly storeys: string }

async function columns(page: Page): Promise<Column[]> {
  const names = await designTable(page).getByRole('button', { name: /^Show .+ in 3D$/ }).allTextContents()
  const [areas, heights, limits, storeys] = await Promise.all(['Floor area', 'Height', 'Limited by', 'Storeys'].map((row) => cells(page, row).allTextContents()))
  return names.map((name, i) => ({ name, area: areas[i], heightM: numberIn(heights[i]), limitedBy: limits[i], storeys: storeys[i] }))
}

function mostFloorArea(designs: readonly Column[]): Column {
  const most = Math.max(...designs.map((d) => numberIn(d.area)))
  return designs.filter((d) => numberIn(d.area) === most).reduce((lowest, d) => (d.heightM < lowest.heightM ? d : lowest))
}

async function allowedText(page: Page) {
  return (await summary(page).getByText(/^[\d,]+\s?(m²|sq ft)$/).first().textContent())!
}

async function expectHeadline(page: Page): Promise<Column> {
  const top = mostFloorArea(await columns(page))
  await expect(summary(page)).toContainText(`${top.name} fits ${top.area}.`)
  await expect(designTable(page).getByRole('button', { name: `Show ${top.name} in 3D` })).toHaveAttribute('aria-pressed', 'true')
  await expect(scene(page)).toHaveAttribute('data-scene-floors', top.storeys)
  return top
}

async function openPlot(page: Page, region: RegionId, plot: Plot) {
  await mockApp(page)
  await openResults(page, [encodeRegion(region), encodePlot(plot)].filter(Boolean).join('&'))
}

test('the Bangkok example headlines its largest design and says the high-rise rules, not the floor area cap, stop it', async ({ page }) => {
  await openPlot(page, 'bkk', EXAMPLE_PLOT)
  const top = await expectHeadline(page)
  expect(numberIn(top.area)).toBeLessThan(numberIn(await allowedText(page)))
  expect(top.limitedBy).toBe('High-rise rules')
  expect(top.name).not.toContain('high-rise')
  await expect(summary(page)).toContainText('Limited by the high-rise rules')
  await expect(designTable(page).getByRole('button', { name: /^Show \d+-storey high-rise podium and tower in 3D$/ })).toBeVisible()
})

for (const { region, plot, title } of [
  { region: 'mum', plot: MUMBAI, title: 'a 20,118 sq ft Mumbai plot on 5 m roads' },
  { region: 'dxb', plot: DUBAI, title: 'a Dubai plot with FAR 3.5 and G+8' },
] as const)
  test(`${title} headlines its largest design, built right up to the floor area cap`, async ({ page }) => {
    await openPlot(page, region, plot)
    const top = await expectHeadline(page)
    expect(top.area).toBe(await allowedText(page))
    expect(top.limitedBy).toBe('Floor area cap')
    expect(top.name).not.toMatch(/low-rise|high-rise/i)
    await expect(summary(page)).toContainText('Limited by the plot’s floor area cap.')
  })
