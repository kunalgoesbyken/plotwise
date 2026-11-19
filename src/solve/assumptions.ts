import type { BuildingType } from '@/plot/plot'

export type Assumption = { readonly value: number; readonly source: string }
type PerUse = Readonly<Record<BuildingType, Assumption>>

const EDITABLE = 'assumption, editable'
const CTBUH =
  'CTBUH Height Calculator floor-to-floor heights by function, https://web.archive.org/web/20180420060414/http:/ctbuh.org/TallBuildings/HeightStatistics/HeightCalculator/tabid/1007/language/en-US/Default.aspx'

export const ASSUMPTIONS = {
  floorToFloorM: {
    condo: { value: 3.1, source: CTBUH },
    office: { value: 3.9, source: CTBUH },
    hotel: { value: 3.1, source: CTBUH },
  } satisfies PerUse,
  netToGross: {
    condo: { value: 0.75, source: `${EDITABLE}; no Bangkok condo efficiency figure was found in research` },
    office: {
      value: 0.725,
      source: 'Building magazine, high-rise office towers cost model, https://www.building.co.uk/high-rise-office-towers-cost-model-may-1997/1025316.article',
    },
  },
  condoUnitSqm: { value: 35, source: `${EDITABLE}; typical new Bangkok one-bedroom, not verified in research` },
  hotelGrossSqmPerRoom: {
    value: 50,
    source: 'HVS India 2016 Hotel Development Cost Survey, 45 to 55 m² GFA per key for 3-star hotels, https://www.hvs.com/Print/India-2016-Hotel-Development-Cost-Survey?id=7852',
  },
  hotelLobbySqmPerRoom: { value: 1, source: `${EDITABLE}; lobby counted as a hall for parking` },
  parkingGrossSqmPerSpace: {
    value: 21.6,
    source: 'Australian Steel Institute, Economical Carparks Design Guide, https://www.steel.org.au/resources/elibrary/resources/economical-carparks-design-guide-introduction_os3/',
  },
  slabDepthM: {
    condo: { value: 20, source: `${EDITABLE}; double-loaded corridor with naturally lit rooms on both sides` },
    office: { value: 25, source: `${EDITABLE}; side core with about 10 m from window to core` },
    hotel: { value: 20, source: `${EDITABLE}; double-loaded corridor of guest rooms` },
  } satisfies PerUse,
  towerPlateSqm: {
    condo: { value: 1000, source: `${EDITABLE}; one core serving about 20 units per floor` },
    office: { value: 2000, source: `${EDITABLE}; central core office floor` },
    hotel: { value: 1000, source: `${EDITABLE}; one core serving about 20 keys per floor` },
  } satisfies PerUse,
  maxRoadWidthM: {
    value: 200,
    source: `${EDITABLE}; input sanity bound, not a rule: the high-rise height limit grows with road width, so an absurd width would make the envelope unbounded`,
  },
  envelopeSteps: {
    value: 8,
    source: 'engine resolution: the height-to-road step-back is drawn in at most this many tiers so a solve stays under 30 ms',
  },
} as const
