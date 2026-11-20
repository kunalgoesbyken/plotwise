import type { Page } from '@playwright/test'
import { ZONE_SOURCES, type ZoneRegionId } from '../src/zone/sources'

export const BROWN_ZONE = 'ย.๙'
export const BLUE_ZONE = 'ส.'

type Strip = { readonly code: string; readonly width: number }
type Corner = readonly [lng: number, lat: number]

const REACH = 0.01
const ALLOW_ANY_ORIGIN = { 'access-control-allow-origin': '*' }

const layerPattern = (region: ZoneRegionId) => `${ZONE_SOURCES[region].layer.url}/query?**`

function queriedBox(url: string) {
  const geometry = JSON.parse(new URL(url).searchParams.get('geometry') ?? '{}') as { rings: Corner[][] }
  const lngs = geometry.rings[0].map(([lng]) => lng)
  const lats = geometry.rings[0].map(([, lat]) => lat)
  return { west: Math.min(...lngs), east: Math.max(...lngs), south: Math.min(...lats), north: Math.max(...lats) }
}

function stripsAnswer(region: ZoneRegionId, url: string, strips: readonly Strip[]) {
  const { west, east, south, north } = queriedBox(url)
  const total = strips.reduce((sum, strip) => sum + strip.width, 0)
  let widthBefore = 0
  const features = strips.map(({ code, width }, index) => {
    const from = index === 0 ? west - REACH : west + ((east - west) * widthBefore) / total
    widthBefore += width
    const to = index === strips.length - 1 ? east + REACH : west + ((east - west) * widthBefore) / total
    const ring: Corner[] = [[from, south - REACH], [from, north + REACH], [to, north + REACH], [to, south - REACH], [from, south - REACH]]
    return { attributes: { [ZONE_SOURCES[region].layer.zoneField]: code }, geometry: { rings: [ring] } }
  })
  return { features }
}

export async function mockZoneStrips(page: Page, region: ZoneRegionId, strips: readonly Strip[]) {
  await page.route(layerPattern(region), (route) =>
    route.fulfill({ json: stripsAnswer(region, route.request().url(), strips), headers: ALLOW_ANY_ORIGIN }),
  )
}

export async function mockZoneDown(page: Page, region: ZoneRegionId) {
  await page.route(layerPattern(region), (route) => route.fulfill({ status: 503, headers: ALLOW_ANY_ORIGIN }))
}

export const SNAPSHOT_DOWN_MESSAGE = 'Failed to load resource: the server responded with a status of 503 (Service Unavailable)'

export async function mockZoneSnapshotDown(page: Page, region: ZoneRegionId) {
  await page.route(`**${ZONE_SOURCES[region].snapshot}`, (route) => route.fulfill({ status: 503 }))
}
