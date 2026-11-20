import type { Page } from '@playwright/test'
import { encodePlot } from '../../src/editor/plot-url'
import type { Plot } from '../../src/plot/plot'
import { mockSite, mockZoneInside } from '../app-fixtures'

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

export const OLD_EXAMPLE_RING: readonly (readonly [number, number])[] = [
  [100.5262, 13.7228],
  [100.526774, 13.7228],
  [100.526774, 13.723052],
  [100.52657, 13.723052],
  [100.52657, 13.723268],
  [100.526163, 13.72325],
]

export const OLD_EXAMPLE_HASH = `plot=${OLD_EXAMPLE_RING.map((corner) => corner.join(',')).join(';')}&roads=0:12&type=condo`

export const hashOf = (plot: Plot, extra = '') => `${encodePlot(plot)}${extra}`

export async function mockApp(page: Page) {
  await mockSite(page)
  await mockZoneInside(page)
}
