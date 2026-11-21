import { ROAD_WIDTH_BY_CLASS_M } from '@/site/assumptions'
import { DUBAI_EXAMPLE_HOME_SQM, DUBAI_EXAMPLE_PARKING_PER_HOME } from '@/solve/assumptions'
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

export const MUMBAI_EXAMPLE_PLOT: Plot = {
  ring: [
    [72.949512, 19.1804679],
    [72.9495111, 19.1801672],
    [72.950255, 19.1800471],
    [72.9503071, 19.1803113],
  ],
  roads: [
    { edge: 0, widthM: ROAD_WIDTH_BY_CLASS_M.value.secondary },
    { edge: 1, widthM: ROAD_WIDTH_BY_CLASS_M.value.residential },
  ],
  buildingType: 'condo',
  nearStation: false,
}

export const DUBAI_EXAMPLE_PLOT: Plot = {
  ring: [
    [55.2095575, 25.0605486],
    [55.2094672, 25.0600975],
    [55.209891, 25.0600157],
    [55.2099585, 25.0604223],
  ],
  roads: [
    { edge: 2, widthM: 5 },
    { edge: 3, widthM: 8 },
  ],
  buildingType: 'condo',
  nearStation: false,
  limits: { maxFar: 3.5, maxStoreys: 9, maxCoverageShare: 0.6, roadSetbackM: 0, boundarySetbackM: 3, parkingSpacesPerHome: DUBAI_EXAMPLE_PARKING_PER_HOME.value, homeSqm: DUBAI_EXAMPLE_HOME_SQM.value },
}
