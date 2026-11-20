import { expect, type Page, type Route } from '@playwright/test'
import { encodePlot } from '../src/editor/plot-url'
import { EXAMPLE_PLOT } from '../src/plot/example-plot'
import { isInside } from '../src/import/validate'
import { REGIONS } from '../src/region/regions'
import mulundWest from '../src/site/__fixtures__/mulund-west.overpass.json'
import ratchadaphisek from '../src/site/__fixtures__/ratchadaphisek.overpass.json'
import { OverpassResponseSchema } from '../src/site/overpass-response'
import { parseOverpass } from '../src/site/parse'
import { BROWN_ZONE, mockZoneSnapshotCovering, mockZoneStrips } from './zone-layers'

const recordedBangkok = parseOverpass(OverpassResponseSchema.parse(ratchadaphisek), REGIONS.bkk.transit)
const recordedMumbai = parseOverpass(OverpassResponseSchema.parse(mulundWest), REGIONS.mum.transit)

const recordedFor = ([minLng, minLat, maxLng, maxLat]: number[]) =>
  isInside([(minLng + maxLng) / 2, (minLat + maxLat) / 2], REGIONS.mum.bounds.value) ? recordedMumbai : recordedBangkok

const fulfilSite = (route: Route) => {
  const bbox = new URL(route.request().url()).searchParams.get('bbox')!.split(',').map(Number)
  return route.fulfill({ json: { bbox, ...recordedFor(bbox), attribution: '© OpenStreetMap contributors (ODbL)' } })
}

export async function mockZoneInside(page: Page) {
  await mockZoneSnapshotCovering(page, 'bkk')
  await mockZoneStrips(page, 'bkk', [{ code: BROWN_ZONE, width: 1 }])
}

export async function mockSite(page: Page) {
  await page.route('**/api/site?**', fulfilSite)
}

export async function openExample(page: Page) {
  await mockZoneInside(page)
  await mockSite(page)
  await page.goto(`/app#${encodePlot(EXAMPLE_PLOT)}`)
  await page.locator('[data-map-ready="true"]').waitFor({ timeout: 30_000 })
  await expect(page.getByRole('table', { name: 'Designs compared', includeHidden: true })).toBeAttached({ timeout: 30_000 })
}
