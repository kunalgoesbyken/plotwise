import type { Page, Route } from '@playwright/test'
import { encodePlot } from '../../src/editor/plot-url'
import type { Plot } from '../../src/plot/plot'
import fixture from '../../src/site/__fixtures__/ratchadaphisek.overpass.json'
import { OverpassResponseSchema } from '../../src/site/overpass-response'
import { parseOverpass } from '../../src/site/parse'

const recorded = parseOverpass(OverpassResponseSchema.parse(fixture))

export const BROWN_ZONE = 'brown zone 9 (very high-density residential)'
const CITY_PLAN = { name: 'BMA city plan', url: 'https://webportal.bangkok.go.th/cpud' }

export const INSIDE = { status: 'inside', zone: BROWN_ZONE } as const
export const OUTSIDE = { status: 'outside', zone: 'blue zone', covered: BROWN_ZONE } as const
export const MIXED = { status: 'mixed', zones: [BROWN_ZONE, 'blue zone'], covered: BROWN_ZONE } as const
export const unchecked = (reason: 'no-region' | 'no-zone' | 'unrecognised' | 'unreachable') => ({ status: 'unknown', reason, plan: CITY_PLAN }) as const

export const RESULTS_PLOT: Plot = {
  ring: [
    [100.5686, 13.7648],
    [100.56915, 13.7648],
    [100.5692, 13.76525],
    [100.5689, 13.7655],
    [100.5686, 13.76545],
  ],
  roads: [{ edge: 0, widthM: 30 }],
  buildingType: 'condo',
  nearStation: false,
}

export const CHATUCHAK_PARK_PLOT: Plot = {
  ring: [
    [100.5524, 13.803],
    [100.5529, 13.803],
    [100.5529, 13.8034],
    [100.5524, 13.8034],
  ],
  roads: [{ edge: 0, widthM: 12 }],
  buildingType: 'condo',
  nearStation: false,
}

export const OLD_EXAMPLE_HASH =
  'plot=100.5262,13.7228;100.526774,13.7228;100.526774,13.723052;100.52657,13.723052;100.52657,13.723268;100.526163,13.72325&roads=0:12&type=condo'

export const hashOf = (plot: Plot, extra = '') => `${encodePlot(plot)}${extra}`

const fulfilSite = (route: Route) => {
  const bbox = new URL(route.request().url()).searchParams.get('bbox')!.split(',').map(Number)
  return route.fulfill({ json: { bbox, ...recorded, attribution: '© OpenStreetMap contributors (ODbL)' } })
}

export function mockSite(page: Page) {
  return page.route('**/api/site?**', fulfilSite)
}

export async function mockApp(page: Page, verdict: object | (() => object) = INSIDE) {
  await mockSite(page)
  return mockZone(page, verdict)
}

export async function mockZone(page: Page, verdict: object | (() => object)) {
  const asked: string[] = []
  await page.route('**/api/zone?**', (route) => {
    asked.push(route.request().url())
    return route.fulfill({ json: typeof verdict === 'function' ? verdict() : verdict })
  })
  return asked
}
