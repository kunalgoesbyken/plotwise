import { expect, type Page, type Route } from '@playwright/test'
import { encodePlot } from '../src/editor/plot-url'
import { EXAMPLE_PLOT } from '../src/plot/example-plot'
import fixture from '../src/site/__fixtures__/ratchadaphisek.overpass.json'
import { OverpassResponseSchema } from '../src/site/overpass-response'
import { REGIONS } from '../src/region/regions'
import { parseOverpass } from '../src/site/parse'
import { BROWN_ZONE, mockZoneStrips } from './zone-layers'

const recorded = parseOverpass(OverpassResponseSchema.parse(fixture), REGIONS.bkk.transit)

const fulfilSite = (route: Route) => {
  const bbox = new URL(route.request().url()).searchParams.get('bbox')!.split(',').map(Number)
  return route.fulfill({ json: { bbox, ...recorded, attribution: '© OpenStreetMap contributors (ODbL)' } })
}

export async function mockZoneInside(page: Page) {
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
