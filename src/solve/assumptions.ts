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
  envelopeSteps: {
    value: 8,
    source: 'engine resolution: the height-to-road step-back is drawn in at most this many tiers so a solve stays under 30 ms',
  },
} as const

export type AssumedRange = { readonly low: number; readonly high: number; readonly source: string }
type ClassRates = { readonly lowRise: AssumedRange; readonly highRise: AssumedRange }

export type MoneyRegion = {
  readonly currency: string
  readonly landUnit: { readonly name: string; readonly sqm: Assumption }
  readonly salePricePerSqm: PerUse
  readonly saleableShare: PerUse
  readonly developerMargin: Assumption
  readonly softCostShare: Assumption
  readonly maxAboveGroundParkingLevels: Assumption
  readonly rates: {
    readonly substructure: ClassRates
    readonly superstructure: ClassRates
    readonly services: Readonly<Record<BuildingType, AssumedRange>>
    readonly basement: AssumedRange
  }
}

const NO_BKK_COST = `${EDITABLE}; no Bangkok construction cost per m² was found in research, the RLB Q3 2025 report and Arcadis 2026 handbook pages read gave no Bangkok rates`
const HOTEL_VALUE_PER_KEY_THB = 7_300_000

export const MONEY_REGIONS = {
  bkk: {
    currency: 'THB',
    landUnit: {
      name: 'square wah',
      sqm: { value: 4, source: 'Thai land measure: 1 rai = 400 square wah = 1,600 m², so 1 square wah = 4 m²; stated conversion, not fetched in research' },
    },
    salePricePerSqm: {
      condo: {
        value: 242_000,
        source: `${EDITABLE}; Bangkok Post, average central Bangkok condo price about THB 242,000 per m² in Q1 2024, reported as an average and not confirmed as new-launch, https://www.bangkokpost.com/property/2724674/bangkok-condo-prices-rise-amid-year-long-surge`,
      },
      office: {
        value: 164_900,
        source: `${EDITABLE}; Real Estate Asia, Bangkok office capital value THB 164,900 per m² at a 5.55% market yield, period not confirmed, https://realestateasia.com/commercial-office/news/bangkok-office-vacancy-rate-spike-30-2030`,
      },
      hotel: {
        value: HOTEL_VALUE_PER_KEY_THB / ASSUMPTIONS.hotelGrossSqmPerRoom.value,
        source: `${EDITABLE}; HVS Asia Pacific Hotel Transactions Bulletin, Royal Orchid Sheraton sold for about THB 7.3 million per key, divided by the hotel gross area per key, https://www.hotelnewsresource.com/article143610.html`,
      },
    },
    saleableShare: {
      condo: { value: ASSUMPTIONS.netToGross.condo.value, source: ASSUMPTIONS.netToGross.condo.source },
      office: { value: ASSUMPTIONS.netToGross.office.value, source: ASSUMPTIONS.netToGross.office.source },
      hotel: { value: 1, source: `${EDITABLE}; hotel value is priced per key and divided by the gross area per key, so all gross area above parking is priced` },
    },
    developerMargin: {
      value: 0.186,
      source: `${EDITABLE}; Sansiri Annual Report 2023 net profit margin of 18.6% of revenue, a listed developer's company-wide figure, https://assets.sansiri.com/o77site/pdf/investor/siri-ar-2023-en.pdf`,
    },
    softCostShare: { value: 0.15, source: `${EDITABLE}; no Bangkok share for design fees, marketing and finance was found in research` },
    maxAboveGroundParkingLevels: {
      value: 5,
      source: `${EDITABLE}; parking levels beyond this go into basements, no Bangkok practice figure was found in research`,
    },
    rates: {
      substructure: {
        lowRise: { low: 4_000, high: 6_000, source: NO_BKK_COST },
        highRise: { low: 8_000, high: 12_000, source: NO_BKK_COST },
      },
      superstructure: {
        lowRise: { low: 13_000, high: 18_000, source: NO_BKK_COST },
        highRise: { low: 17_000, high: 24_000, source: NO_BKK_COST },
      },
      services: {
        condo: { low: 7_000, high: 10_000, source: NO_BKK_COST },
        office: { low: 10_000, high: 14_000, source: NO_BKK_COST },
        hotel: { low: 13_000, high: 19_000, source: NO_BKK_COST },
      },
      basement: { low: 30_000, high: 45_000, source: NO_BKK_COST },
    },
  },
} as const satisfies Record<string, MoneyRegion>

export type RegionId = keyof typeof MONEY_REGIONS
