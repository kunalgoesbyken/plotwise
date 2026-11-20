import type { Page } from '@playwright/test'
import { decodePlot } from '../src/editor/plot-url'
import {
  DXF_CURVED_AND_STRAIGHT,
  DXF_MM,
  DXF_UTM,
  GEOJSON_MULTI_POLYGON,
  GEOJSON_ONE_POLYGON,
  KML_ONE_POLYGON,
  KML_TWO_POLYGONS,
  PLOT_LNG_LAT,
  PLOT_UTM_47N,
} from '../src/import/fixtures'
import type { LngLat } from '../src/geo/projection'
import { mockSite, mockZoneInside } from './app-fixtures'
import { expect, test } from './support/test'

const DESKTOP = { width: 1280, height: 800 }
const PHONE = { width: 375, height: 812 }
const DEGREES_TOLERANCE = 2e-5

const SECOND_PARCEL: readonly LngLat[] = [
  [100.5771, 13.7791],
  [100.5775, 13.7791],
  [100.5775, 13.7795],
  [100.5771, 13.7795],
]

const asLines = (points: readonly (readonly [number, number])[]) => points.map(([a, b]) => `${a}, ${b}`).join('\n')

async function openImport(page: Page, viewport = DESKTOP) {
  await page.setViewportSize(viewport)
  await mockSite(page)
  await mockZoneInside(page)
  await page.goto('/app')
  await page.locator('[data-map-ready="true"]').waitFor({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Import coordinates or a file' }).click()
}

const pasteBox = (page: Page) => page.getByLabel('Paste corner coordinates')
const fileInput = (page: Page) => page.getByLabel('Or choose a KML, GeoJSON or DXF file')
const confirmButton = (page: Page) => page.getByRole('button', { name: 'Use this outline' })

const alert = (page: Page, text: string) => page.getByRole('alert').filter({ hasText: text })

const upload = (page: Page, name: string, text: string) => fileInput(page).setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from(text) })

async function finishWithRoad(page: Page) {
  await confirmButton(page).click()
  await expect(page.locator('.map-label-corner').getByText('D', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Mark as road, edge A–B' }).click()
  await page.getByLabel('Road width on edge A–B, in metres').fill('12')
  await expect(page.getByRole('region', { name: 'Results for the design shown in 3D' })).toBeVisible({ timeout: 30_000 })
  await expect.poll(() => new URL(page.url()).hash).toContain('plot=')
  const link = decodePlot(new URL(page.url()).hash)
  if (!link?.ok) throw new Error('the plot did not reach the link')
  return link.plot
}

function expectRing(actual: readonly LngLat[], expected: readonly (readonly [number, number])[]) {
  expect(actual).toHaveLength(expected.length)
  for (const [lng, lat] of expected) {
    const near = actual.some(([x, y]) => Math.abs(x - lng) < DEGREES_TOLERANCE && Math.abs(y - lat) < DEGREES_TOLERANCE)
    expect(near, `corner ${lng}, ${lat}`).toBe(true)
  }
}

for (const [name, viewport] of [
  ['desktop', DESKTOP],
  ['phone', PHONE],
] as const) {
  test(`pasted coordinates become the plot and its results on a ${name}`, async ({ page }) => {
    await openImport(page, viewport)
    await pasteBox(page).fill(asLines(PLOT_LNG_LAT))
    await expect(page.getByText(/^4 corners, [\d,]+\sm²$/)).toBeVisible()
    const plot = await finishWithRoad(page)
    expectRing(plot.ring, PLOT_LNG_LAT)
    expect(plot.roads).toEqual([{ edge: 0, widthM: 12 }])
    })
}

test('semicolon-separated coordinates in latitude then longitude order are detected', async ({ page }) => {
  await openImport(page)
  await pasteBox(page).fill(PLOT_LNG_LAT.map(([lng, lat]) => `${lat} ${lng}`).join('; '))
  await expect(page.getByText(/^4 corners, [\d,]+\sm²$/)).toBeVisible()
  const plot = await finishWithRoad(page)
  expectRing(plot.ring, PLOT_LNG_LAT)
})

test('one line of space-separated longitude,latitude pairs, as KML writes them, becomes the plot', async ({ page }) => {
  await openImport(page)
  await pasteBox(page).fill(PLOT_LNG_LAT.map(([lng, lat]) => `${lng},${lat}`).join(' '))
  await expect(page.getByText(/^4 corners, [\d,]+\sm²$/)).toBeVisible()
  expectRing((await finishWithRoad(page)).ring, PLOT_LNG_LAT)
})

test('one line of latitude,longitude pairs is detected too, and a broken pair is named', async ({ page }) => {
  await openImport(page)
  await pasteBox(page).fill('100.5,13.7 100.6,abc 100.6,13.8')
  await expect(alert(page, 'Entry 2 is not a pair of numbers. Write one corner per line, like 100.5754, 13.7787.')).toBeVisible()
  await pasteBox(page).fill(PLOT_LNG_LAT.map(([lng, lat]) => `${lat},${lng}`).join(' '))
  await expect(page.getByText(/^4 corners, [\d,]+\sm²$/)).toBeVisible()
  expectRing((await finishWithRoad(page)).ring, PLOT_LNG_LAT)
})

const PLACEHOLDERS = [
  { region: 'Bangkok', lines: ['100.5754, 13.7787', '100.5757, 13.7787', '100.5757, 13.7791'] },
  { region: 'Mumbai', lines: ['72.9495, 19.1805', '72.9495, 19.1802', '72.9503, 19.1800'] },
  { region: 'Dubai', lines: ['55.2096, 25.0605', '55.2095, 25.0601', '55.2099, 25.0600'] },
  { region: 'Custom rules', lines: ['longitude, latitude', 'longitude, latitude', 'longitude, latitude'] },
] as const

test('the paste box shows example corners inside the chosen region, and a neutral example for custom rules', async ({ page }) => {
  await openImport(page)
  for (const { region, lines } of PLACEHOLDERS) {
    await page.getByRole('radiogroup', { name: 'Rules' }).getByRole('radio', { name: region }).click()
    await expect(pasteBox(page)).toHaveAttribute('placeholder', lines.join('\n'))
  }
})

test('pasted UTM metres wait for the zone, then land on the same plot', async ({ page }) => {
  await openImport(page)
  await pasteBox(page).fill(asLines(PLOT_UTM_47N))
  await expect(page.getByText('Answer the questions above to see the outline.')).toBeVisible()
  await expect(confirmButton(page)).toHaveCount(0)
  await expect(page.getByText('Bangkok is in zone 47 N.')).toBeVisible()
  await page.getByLabel('UTM zone').fill('47')
  await page.getByLabel('Hemisphere').selectOption('N')
  await expect(page.getByText(/^4 corners, [\d,]+\sm²$/)).toBeVisible()
  expectRing((await finishWithRoad(page)).ring, PLOT_LNG_LAT)
})

test('the wrong UTM zone is caught instead of drawing a plot in another country', async ({ page }) => {
  await openImport(page)
  await pasteBox(page).fill(asLines(PLOT_UTM_47N))
  await page.getByLabel('UTM zone').fill('31')
  await page.getByLabel('Hemisphere').selectOption('N')
  await expect(page.getByText('These corners fall outside Thailand.', { exact: false })).toBeVisible()
  await expect(confirmButton(page)).toHaveCount(0)
})

test('a KML file with two polygons asks which one is the plot', async ({ page }) => {
  await openImport(page)
  await upload(page, 'survey.kml', KML_TWO_POLYGONS)
  const picker = page.getByLabel('Which shape is the plot?')
  await expect(picker.getByRole('option')).toHaveText([/แปลงที่ 1 · 4 corners · [\d,]+\sm²/, /Plot B · 4 corners · [\d,]+\sm²/])
  await picker.selectOption({ index: 1 })
  expectRing((await finishWithRoad(page)).ring, SECOND_PARCEL)
})

test('a KML file with one polygon needs no questions', async ({ page }) => {
  await openImport(page)
  await upload(page, 'plot.kml', KML_ONE_POLYGON)
  await expect(page.getByLabel('Which shape is the plot?')).toHaveCount(0)
  expectRing((await finishWithRoad(page)).ring, PLOT_LNG_LAT)
})

test('a GeoJSON file is read, and a multipolygon lists its parts', async ({ page }) => {
  await openImport(page)
  await upload(page, 'plot.geojson', GEOJSON_ONE_POLYGON)
  await expect(page.getByText(/^4 corners, [\d,]+\sm²$/)).toBeVisible()
  await upload(page, 'parcels.json', GEOJSON_MULTI_POLYGON)
  await page.getByLabel('Which shape is the plot?').selectOption({ index: 1 })
  expectRing((await finishWithRoad(page)).ring, SECOND_PARCEL)
})

test('a DXF in UTM metres takes its unit from the file and asks for the zone', async ({ page }) => {
  await openImport(page)
  await upload(page, 'survey.dxf', DXF_UTM)
  await expect(page.getByLabel('Units of the drawing')).toHaveValue('m')
  await expect(page.getByText('The file states this unit.', { exact: false })).toBeVisible()
  await page.getByRole('radio', { name: 'Its coordinates are UTM' }).check()
  await page.getByLabel('UTM zone').fill('47')
  await page.getByLabel('Hemisphere').selectOption('N')
  await page.getByLabel('Which shape is the plot?').selectOption({ index: 1 })
  await expect(page.getByLabel('Which shape is the plot?').locator('option:checked')).toContainText('PLOT')
  expectRing((await finishWithRoad(page)).ring, PLOT_LNG_LAT)
})

test('a DXF in millimetres is placed from a reference point and never guessed', async ({ page }) => {
  await openImport(page)
  await upload(page, 'lot.dxf', DXF_MM)
  await expect(page.getByLabel('Units of the drawing')).toHaveValue('mm')
  await expect(confirmButton(page)).toHaveCount(0)
  await page.getByRole('radio', { name: 'Put its first corner at a point' }).check()
  await page.getByLabel('Longitude of the first corner').fill(String(PLOT_LNG_LAT[0][0]))
  await page.getByLabel('Latitude of the first corner').fill(String(PLOT_LNG_LAT[0][1]))
  await expect(page.getByText(/^4 corners, [\d,]+\sm²$/)).toBeVisible()
  const plot = await finishWithRoad(page)
  expect(plot.ring).toHaveLength(4)
  const first = plot.ring.find(([x, y]) => Math.abs(x - PLOT_LNG_LAT[0][0]) < 1e-6 && Math.abs(y - PLOT_LNG_LAT[0][1]) < 1e-6)
  expect(first).toBeDefined()
})

test('a curved polyline stays in the picker, marked, and says why it cannot be used', async ({ page }) => {
  await openImport(page)
  await upload(page, 'corner-lot.dxf', DXF_CURVED_AND_STRAIGHT)
  const picker = page.getByLabel('Which shape is the plot?')
  await expect(picker.getByRole('option')).toHaveText([/^CURVED · 4 corners · curved, cannot be used$/, /^STRAIGHT · 4 corners$/])
  const curvedMessage = page.getByText('This polyline has curved segments', { exact: false })
  await expect(picker.locator('option:checked')).toHaveText('STRAIGHT · 4 corners')
  await expect(curvedMessage).toHaveCount(0)
  await picker.selectOption({ index: 0 })
  await expect(curvedMessage).toBeVisible()
  await expect(confirmButton(page)).toHaveCount(0)
})

test('wrong units are caught by the plot size range', async ({ page }) => {
  await openImport(page)
  await upload(page, 'lot.dxf', DXF_MM)
  await page.getByLabel('Units of the drawing').selectOption('m')
  await page.getByRole('radio', { name: 'Put its first corner at a point' }).check()
  await page.getByLabel('Longitude of the first corner').fill('100.5')
  await page.getByLabel('Latitude of the first corner').fill('13.7')
  await expect(page.getByText('too large for one plot', { exact: false })).toBeVisible()
  await expect(confirmButton(page)).toHaveCount(0)
})

test('says what is wrong with a file or a paste it cannot use', async ({ page }) => {
  await openImport(page)
  await upload(page, 'broken.kml', '<kml><Document>')
  await expect(alert(page, 'That KML file is damaged')).toBeVisible()
  await upload(page, 'drawing.dwg', 'AC1015')
  await expect(alert(page, 'Only KML, GeoJSON and DXF files can be imported')).toBeVisible()
  await upload(page, 'plot.geojson', '{"type":"FeatureCollection","features":[]}')
  await expect(alert(page, 'No polygon was found')).toBeVisible()
  await upload(page, 'plot.dxf', 'AutoCAD Binary DXF\r\n\x1a\x00')
  await expect(alert(page, 'binary DXF')).toBeVisible()
  await pasteBox(page).fill('100.5, 13.7\n100.6, abc\n100.6, 13.8')
  await expect(alert(page, 'Entry 2 is not a pair of numbers')).toBeVisible()
  await pasteBox(page).fill('100.5, 13.7\n100.501, 13.701\n100.501, 13.7\n100.5, 13.701')
  await expect(page.getByText('The outline crosses itself.')).toBeVisible()
  await expect(confirmButton(page)).toHaveCount(0)
})

test('the import controls fit a phone with 44 px targets and no sideways scroll', async ({ page }) => {
  await openImport(page, PHONE)
  await upload(page, 'lot.dxf', DXF_MM)
  await page.getByRole('radio', { name: 'Put its first corner at a point' }).check()
  const sizes = await page.evaluate(() => {
    const controls = document.querySelectorAll('textarea, input:not([type=radio]), select, button, label:has(input[type=radio])')
    return {
      scrollW: document.documentElement.scrollWidth,
      smallest: Math.min(...[...controls].filter((c) => c.getClientRects().length > 0 && (c as HTMLElement).offsetParent !== null).map((c) => c.getBoundingClientRect().height)),
    }
  })
  expect(sizes.scrollW).toBe(375)
  expect(sizes.smallest).toBeGreaterThanOrEqual(44)
})
