import type { Plot } from './plot'

export const EXAMPLE_PLOT: Plot = {
  ring: [
    [100.575355, 13.77867],
    [100.57568, 13.778661],
    [100.575694, 13.779116],
    [100.575382, 13.779044],
  ],
  roads: [
    { edge: 0, widthM: 12 },
    { edge: 1, widthM: 5 },
    { edge: 3, widthM: 5 },
  ],
  buildingType: 'condo',
  nearStation: false,
}
