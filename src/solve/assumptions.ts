import type { BuildingType } from '@/plot/plot'
import type { Interpretations, QuestionId } from './interpretations'

export type Assumption = { readonly value: number; readonly source: string }
type PerUse = Readonly<Record<BuildingType, Assumption>>

export const AREA_TIERS = ['cbd', 'cityFringe', 'suburban'] as const
export type AreaTier = (typeof AREA_TIERS)[number]
type PerTier<T> = Readonly<Record<AreaTier, T>>

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
  unboundedHeightStoreys: {
    value: 50,
    source: 'engine resolution: where a pack sets no height limit of any kind the envelope is drawn this many storeys tall, and floor area, setbacks and the road-height rule carve it down',
  },
  roadWidthStepM: { value: 2, source: 'display choice: the road-width table shows the result this much narrower and wider than the width entered' },
  importMinPlotSqm: {
    value: 10,
    source: 'input guard, not a rule: an imported outline smaller than a small room is a unit or coordinate mistake, not a plot',
  },
  importMaxPlotSqm: {
    value: 1_000_000,
    source: 'input guard, not a rule: 1 km² (625 rai) is far larger than any single plot checked here, so a bigger imported outline is a unit or coordinate mistake',
  },
  importMaxFileBytes: {
    value: 10_000_000,
    source: 'input guard: the file is read whole in the browser, and a plot outline needs a few kilobytes, so this leaves room for a large survey drawing while bounding memory',
  },
} as const

const UNPOSED = 'engine default for a pack that poses no such question, the strictest reading'

export const DEFAULT_READINGS = {
  'hotel-residential': { value: 'public-building', source: UNPOSED },
  'condo-public-building': { value: 'public', source: UNPOSED },
  'office-public-building': { value: 'public', source: UNPOSED },
  'open-space-base': { value: 'all-stricter', source: UNPOSED },
  'parking-source': { value: 'higher-of-both', source: UNPOSED },
  'permeable-base': { value: 'required', source: UNPOSED },
  'gfa-includes-parking': { value: 'counts', source: UNPOSED },
  'office-operating-area': { value: 'gfa', source: UNPOSED },
  'road-access-tiers': { value: 'frontage-and-row', source: UNPOSED },
  'bylaw-2569-scope': { value: 'unverified', source: UNPOSED },
  'front-open-space': { value: 'always', source: UNPOSED },
} as const satisfies { readonly [Id in QuestionId]: { readonly value: Interpretations[Id]; readonly source: string } }

export type AssumedRange = { readonly low: number; readonly high: number; readonly source: string }
type ClassRates = { readonly lowRise: AssumedRange; readonly highRise: AssumedRange }

export type AreaMap = {
  readonly centre: { readonly name: string; readonly lng: number; readonly lat: number }
  readonly radiusKm: { readonly cbd: number; readonly cityFringe: number; readonly coverage: number }
  readonly fallbackTier: AreaTier
  readonly source: string
}

export type MoneyRegion = {
  readonly currency: string
  readonly landUnit: { readonly name: string; readonly sqm: Assumption }
  readonly areas: AreaMap
  readonly salePricePerSqm: Readonly<Record<BuildingType, PerTier<Assumption>>>
  readonly landReferencePerUnit: PerTier<AssumedRange>
  readonly landWarningFactor: Assumption
  readonly saleableShare: PerUse
  readonly developerMargin: Assumption
  readonly softCostShare: Assumption
  readonly transferCostShare: Assumption
  readonly holdingCostShare: Assumption
  readonly landFinanceShare: Assumption
  readonly maxAboveGroundParkingLevels: Assumption
  readonly rates: {
    readonly substructure: ClassRates
    readonly superstructure: ClassRates
    readonly services: Readonly<Record<BuildingType, AssumedRange>>
    readonly basement: AssumedRange
  }
}

const UNSOURCED = 'Plotwise estimate, unsourced'
const RHLB_COST_GUIDE =
  'RHLB (Siam) Ltd., Construction cost commentary July 2025, residential condominium THB 25,500 to 49,500 per m² of construction floor area from low to high quality, http://www.rhlb.co.th/wp-content/uploads/research/Construction-cost-commentary-July%202025.pdf'
const NO_BKK_COST = `${UNSOURCED}; no published Bangkok split into substructure, superstructure and services was found, so each rate is editable. Cross-check on the total: ${RHLB_COST_GUIDE}`
const HOTEL_VALUE_PER_KEY_THB = 7_300_000
const KNIGHT_FRANK_Q1_2026 = 'https://content.knightfrank.com/research/2265/documents/en/bangkok-condominium-market-q1-2026-12909.pdf'
const KNIGHT_FRANK_AREAS = 'https://content.knightfrank.com/research/2265/documents/en/bangkok-condominium-market-q2-2021-8431.pdf'
const COLLIERS_JUNE_2026 =
  'https://www.thaiexaminer.com/thai-news-foreigners/2026/06/04/colliers-boss-in-thailand-says-now-is-the-time-to-buy-into-the-countrys-resilient-property-market/'
const THAILAND_PROPERTY = 'https://www.thailand-property.com/land-for-sale/bangkok'

const everyTier = (assumption: Assumption): PerTier<Assumption> => ({ cbd: assumption, cityFringe: assumption, suburban: assumption })

const knightFrankCondo = (area: string, value: number): Assumption => ({
  value,
  source: `${EDITABLE}; Knight Frank Thailand, Bangkok Condominium Market Overview Q1 2026, ${area} average asking price of approximately THB ${value.toLocaleString('en-US')} per m², an average over all listed condominiums, not new launches, ${KNIGHT_FRANK_Q1_2026}`,
})

export const MONEY_REGIONS = {
  bkk: {
    currency: 'THB',
    landUnit: {
      name: 'square wah',
      sqm: { value: 4, source: 'Thai land measure: 1 rai = 400 square wah = 1,600 m², so 1 square wah = 4 m²; stated conversion, not fetched in research' },
    },
    areas: {
      centre: { name: 'Ratchaprasong', lng: 100.5409, lat: 13.7446 },
      radiusKm: { cbd: 3, cityFringe: 9, coverage: 40 },
      fallbackTier: 'cityFringe',
      source: `${UNSOURCED}; straight-line distance from Ratchaprasong, a Central Lumpinee sub-area of Knight Frank's CBD (${KNIGHT_FRANK_AREAS}). Knight Frank defines its areas by road and soi, not by distance, so the 3 km and 9 km radii are chosen to keep its named city-fringe corridors (Ratchadaphisek Soi 1 to 17, Rama 9, Phahonyothin Soi 1 to 15) in the fringe. That makes the CBD smaller than Knight Frank's, which errs conservative. The 40 km limit marks where the Bangkok tiers stop applying, and there the city fringe value is used`,
    },
    salePricePerSqm: {
      condo: {
        cbd: knightFrankCondo('CBD', 236_800),
        cityFringe: knightFrankCondo('City Fringe', 123_500),
        suburban: knightFrankCondo('Bangkok Suburbs', 71_200),
      },
      office: everyTier({
        value: 164_900,
        source: `${EDITABLE}; Real Estate Asia, Bangkok office capital value THB 164,900 per m² at a 5.55% market yield, period not confirmed, not split by area, https://realestateasia.com/commercial-office/news/bangkok-office-vacancy-rate-spike-30-2030`,
      }),
      hotel: everyTier({
        value: HOTEL_VALUE_PER_KEY_THB / ASSUMPTIONS.hotelGrossSqmPerRoom.value,
        source: `${EDITABLE}; HVS Asia Pacific Hotel Transactions Bulletin, Royal Orchid Sheraton sold for about THB 7.3 million per key, divided by the hotel gross area per key, not split by area, https://www.hotelnewsresource.com/article143610.html`,
      }),
    },
    landReferencePerUnit: {
      cbd: {
        low: 1_000_000,
        high: 4_000_000,
        source: `${EDITABLE}; asking and marketed prices per square wah reported by Colliers on 4 June 2026: "Land prices along sections of Ratchadaphisek Road have already exceeded 1 million baht per square wah" and Chidlom, Ploenchit and Wireless Road "currently range between 3 million and 4 million baht per square wah", ${COLLIERS_JUNE_2026}`,
      },
      cityFringe: {
        low: 170_000,
        high: 345_000,
        source: `${EDITABLE}; Huai Khwang land listings per square wah, low end a Yor.9 plot near MRT Sutthisan listed at THB 170,000 on Hipflat, the median list price THB 234,468 on ${THAILAND_PROPERTY}/huai-khwang/huai-khwang (undated listing site), high end THB 345,000 as supplied by the project reviewer and not re-checked`,
      },
      suburban: {
        low: 25_632,
        high: 82_344,
        source: `${EDITABLE}; median list price per square wah on thailand-property.com, low end Lat Krabang THB 25,632 (${THAILAND_PROPERTY}/lat-krabang), high end all of Bangkok THB 82,344 (${THAILAND_PROPERTY}), undated listing site`,
      },
    },
    landWarningFactor: {
      value: 2,
      source: `${UNSOURCED}; the land value a design supports is flagged when it is more than this many times the high end of the typical asking range`,
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
    softCostShare: {
      value: 0.15,
      source: `${UNSOURCED}; design fees, marketing and overheads on the build cost, no Bangkok share was found in research. Finance on the land is a separate line`,
    },
    transferCostShare: {
      value: 0.01,
      source: `${EDITABLE}; the land transfer fee is 2% of the Treasury appraised value (https://www.peakaccount.com/blog/tax/specific-business-tax/know-about-land-tax) and is usually split half each (https://aplusme.org/blog/tax-company-property-transfer-fees.html), so the buyer's half is taken on the land price as a stand-in for the appraised value. Specific business tax of 3.3%, stamp duty and withholding tax normally fall on the seller and are not deducted`,
    },
    holdingCostShare: {
      value: 0.02,
      source: `${UNSOURCED}; land and building tax, security and site upkeep between buying the land and starting construction, as a share of the land price`,
    },
    landFinanceShare: {
      value: 0.1,
      source: `${UNSOURCED}; interest on the land price carried through approvals and construction, about 4% a year for about 2.5 years, as a share of the land price`,
    },
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
