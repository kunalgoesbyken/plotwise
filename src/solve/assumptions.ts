import type { BuildingType, PlotLimitField } from '@/plot/plot'
import { SQM_PER_SQFT } from '@/units/area'
import type { Interpretations, QuestionId } from './interpretations'

export type Assumption = { readonly value: number; readonly source: string }
type PerUse = Readonly<Record<BuildingType, Assumption>>

export const AREA_TIERS = ['cbd', 'cityFringe', 'suburban'] as const
export type AreaTier = (typeof AREA_TIERS)[number]
type PerTier<T> = Readonly<Record<AreaTier, T>>

const EDITABLE = 'assumption, editable'
const CTBUH =
  'CTBUH Height Calculator floor-to-floor heights by function, https://web.archive.org/web/20180420060414/http:/ctbuh.org/TallBuildings/HeightStatistics/HeightCalculator/tabid/1007/language/en-US/Default.aspx'

const IMPORT_MAX_PLOT_SQM = {
  value: 1_000_000,
  source: 'input guard, not a rule: 1 km² (625 rai) is far larger than any single plot checked here, so a bigger imported outline is a unit or coordinate mistake',
}

const PLOT_MAX_FAR = {
  value: 100,
  source: 'input guard, not a rule: a floor area ratio of 100 is a 100-storey building over the whole plot, so a larger ratio entered for a plot is a typing slip',
}

const TALLEST_BUILDING = 'Burj Khalifa, the tallest building completed, is 828 m tall with 163 storeys above ground (CTBUH, https://www.skyscrapercenter.com/building/burj-khalifa/3)'

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
  wideningShareOnPlotSide: {
    value: 0.5,
    source:
      'assumption, editable: a road is widened equally on both sides of its centre line, so a plot gives up half the extra width along its frontage. A development plan may take the whole widening from one side; the strip then is deeper, so check the plan’s road line',
  },
  roadWidthStepM: { value: 2, source: 'display choice: the road-width table shows the result this much narrower and wider than the width entered' },
  importMinPlotSqm: {
    value: 10,
    source: 'input guard, not a rule: an imported outline smaller than a small room is a unit or coordinate mistake, not a plot',
  },
  importMaxPlotSqm: IMPORT_MAX_PLOT_SQM,
  plotMaxFar: PLOT_MAX_FAR,
  plotMaxGfaSqm: {
    value: PLOT_MAX_FAR.value * IMPORT_MAX_PLOT_SQM.value,
    source: 'input guard, not a rule: the largest floor area ratio accepted over the largest plot accepted, so a larger floor area entered for a plot is a typing slip',
  },
  plotMaxHeightM: { value: 1000, source: `input guard, not a rule: ${TALLEST_BUILDING}, so a taller limit entered for a plot is a typing slip` },
  plotMaxStoreys: { value: 200, source: `input guard, not a rule: ${TALLEST_BUILDING}, so more storeys entered for a plot is a typing slip` },
  plotMaxSetbackM: {
    value: 200,
    source: 'input guard, not a rule: setback rules ask for metres or tens of metres, so a setback longer than a city block entered for a plot is a typing slip',
  },
  plotMaxParkingSqmPerSpace: {
    value: 10_000,
    source: 'input guard, not a rule: one parking space per hectare of floor area is no parking requirement at all, so a larger figure entered for a plot is a typing slip',
  },
  importMaxShapes: {
    value: 200,
    source: 'input guard: the picker lists every shape of a file, and a survey drawing with more than a few hundred closed shapes is a whole site, not one plot, so the user is asked to export only the plot layer',
  },
  importMaxPasteChars: {
    value: 20_000,
    source: 'input guard: a plot has at most 100 corners of about 40 characters each, so ten times that bounds what is parsed on every keystroke',
  },
  importMaxXmlDepth: {
    value: 100,
    source: 'input guard: real KML nests Document, Folder and Placemark a handful of levels deep, so a deeper file is malformed or hostile and is refused before it is walked',
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

export type MoneyPrices = {
  readonly areas: AreaMap
  readonly salePricePerSqm: Readonly<Record<BuildingType, PerTier<Assumption>>>
  readonly landReferencePerUnit: PerTier<AssumedRange>
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

export type MoneyRegion = {
  readonly currency: string | null
  readonly landUnit: { readonly name: string; readonly sqm: Assumption }
  readonly oldLinkLandUnitSqm: Assumption | null
  readonly landWarningFactor: Assumption
  readonly prices: MoneyPrices | null
}

const UNSOURCED = 'Plotwise estimate, unsourced'

const LAND_WARNING_FACTOR: Assumption = {
  value: 2,
  source: `${UNSOURCED}; the land value a design supports is flagged when it is more than this many times the high end of the typical asking range`,
}
const BOI_COSTS =
  'Thailand Board of Investment, Cost of Doing Business in Thailand, Typical Costs of Starting and Operating a Business, section 5 Construction Cost, from Tractus Asia Ltd, https://www.boi.go.th/en/typical_costs_of_starting_and_operating_a_business. The page says "updated as of September 2025" and "Last Update: March 27th, 2026", but its construction figures are the same baht figures as the 2020 edition, https://www.boi.go.th/upload/content/Cost_of_Doing_Business2020.pdf'
const RHLB_COSTS =
  'RHLB (Siam) Ltd., Construction Commentary, issue July 2025, Approximate Order of Construction Costs per m² of construction floor area, http://www.rhlb.co.th/wp-content/uploads/research/Construction-cost-commentary-July%202025.pdf'
const BOI_OFFICE = { low: 25_000, high: 35_000 }
const BOI_BASEMENT_CAR_PARK = { low: 16_000, high: 20_000 }
const HOTEL_VALUE_PER_KEY_THB = 7_300_000
const CBRE_Q3_2026 =
  'CBRE Thailand, Bangkok Overall Figures Q3 2026, published 18 November 2026, page 2, https://mktgdocs.cbre.com/2299/8a1f5389-9d73-4ae3-b3e0-d41d19e72f4f-1453980461/Bangkok-Overall-Figures-Q3_202.pdf'
const KNIGHT_FRANK_Q1_2026 = 'https://content.knightfrank.com/research/2265/documents/en/bangkok-condominium-market-q1-2026-12909.pdf'
const KNIGHT_FRANK_AREAS = 'https://content.knightfrank.com/research/2265/documents/en/bangkok-condominium-market-q2-2021-8431.pdf'
const COLLIERS_JUNE_2026 =
  'https://www.thaiexaminer.com/thai-news-foreigners/2026/06/04/colliers-boss-in-thailand-says-now-is-the-time-to-buy-into-the-countrys-resilient-property-market/'
const THAILAND_PROPERTY = 'https://www.thailand-property.com/land-for-sale/bangkok'
const TREASURY_BANGKOK_2566_2569 =
  'Treasury Department, summary of appraised land prices per land unit, Bangkok, accounting cycle B.E. 2566 to 2569 (2023 to 2026), file "สรุปราคาประเมินทุนทรัพย์ที่ดิน_รอบบัญชี_พ.ศ.2566 - 2569_กรุงเทพมหานคร.pdf", page 1, land office area of Dusit, Bang Kho Laem, Bang Rak, Pathum Wan, Pom Prap Sattru Phai, Phra Nakhon, Yan Nawa, Samphanthawong and Sathon, from https://assessprice.treasury.go.th'

type Band = { readonly low: number; readonly high: number }
type Structure = { readonly substructure: AssumedRange; readonly superstructure: AssumedRange }

const thb = (value: number) => `THB ${value.toLocaleString('en-US')}`

const band = ({ low, high }: Band) => `${thb(low)} to ${thb(high)}`

const buildingTotal = ({ substructure, superstructure }: Structure, services: Band): Band => ({
  low: substructure.low + superstructure.low + services.low,
  high: substructure.high + superstructure.high + services.high,
})

const RHLB_TOTALS = `RHLB residential condominium THB 25,500 to 49,500, office THB 26,000 to 39,000 and hotel, including furniture, fittings and equipment that these rates leave out, THB 49,000 to 64,500 per m², ${RHLB_COSTS}`

const PLOTWISE_SPLIT = `${UNSOURCED}; BOI and RHLB publish whole-building rates only, not a split into substructure, superstructure and services, so this split is Plotwise's own. Published totals to compare: BOI office (construction) ${band(BOI_OFFICE)} per m² for medium to high quality, ${BOI_COSTS}; ${RHLB_TOTALS}`

const LOW_RISE_STRUCTURE = {
  substructure: { low: 4_000, high: 6_000, source: PLOTWISE_SPLIT },
  superstructure: { low: 13_000, high: 18_000, source: PLOTWISE_SPLIT },
} as const satisfies Structure

const HIGH_RISE_STRUCTURE = {
  substructure: { low: 8_000, high: 12_000, source: PLOTWISE_SPLIT },
  superstructure: { low: 17_000, high: 24_000, source: PLOTWISE_SPLIT },
} as const satisfies Structure

const defaultTotals = (services: Band) =>
  `At the default rates a low-rise building totals ${band(buildingTotal(LOW_RISE_STRUCTURE, services))} per m² and a high-rise one ${band(buildingTotal(HIGH_RISE_STRUCTURE, services))}`

const noBoiRow = (use: string, services: Band): AssumedRange => ({
  ...services,
  source: `${UNSOURCED}; the BOI table has no ${use} row and no published Bangkok split into substructure, superstructure and services was found. ${defaultTotals(services)}. Compare ${RHLB_TOTALS}`,
})

const officeServices = (bound: keyof Band) =>
  BOI_OFFICE[bound] - LOW_RISE_STRUCTURE.substructure[bound] - LOW_RISE_STRUCTURE.superstructure[bound]

const BOI_OFFICE_SERVICES_BAND: Band = { low: officeServices('low'), high: officeServices('high') }

const BOI_OFFICE_SERVICES: AssumedRange = {
  ...BOI_OFFICE_SERVICES_BAND,
  source: `${EDITABLE}; BOI office (construction) ${band(BOI_OFFICE)} per m² for medium to high quality ("The cost includes communal air conditioning, general electrics, and sanitary"), less the low-rise substructure and superstructure rates, which are unsourced Plotwise estimates, so a low-rise office totals the BOI range. BOI gives one range for every height: at the default rates a high-rise office totals ${band(buildingTotal(HIGH_RISE_STRUCTURE, BOI_OFFICE_SERVICES_BAND))} per m², which extends above both the BOI range and RHLB's office range of THB 26,000 to 39,000, ${RHLB_COSTS}. ${BOI_COSTS}`,
}

const everyTier = (assumption: Assumption): PerTier<Assumption> => ({ cbd: assumption, cityFringe: assumption, suburban: assumption })

const knightFrankCondo = (area: string, value: number): Assumption => ({
  value,
  source: `${EDITABLE}; Knight Frank Thailand, Bangkok Condominium Market Overview Q1 2026, ${area} average asking price of approximately ${thb(value)} per m², an average over all listed condominiums, not new launches, ${KNIGHT_FRANK_Q1_2026}. Knight Frank splits the city fringe from the suburbs, so it is used here. For comparison, the asking price of off-plan and under-construction condominium units in CBRE's combined Midtown/Suburban Bangkok was THB 110,696 per m² in Q3 2026, ${CBRE_Q3_2026}`,
})

const BANGKOK_PRICES = {
  areas: {
    centre: { name: 'Ratchaprasong', lng: 100.5409, lat: 13.7446 },
    radiusKm: { cbd: 3, cityFringe: 9, coverage: 40 },
    fallbackTier: 'cityFringe',
    source: `${UNSOURCED}; straight-line distance from Ratchaprasong, a Central Lumpinee sub-area of Knight Frank's CBD (${KNIGHT_FRANK_AREAS}). Knight Frank defines its areas by road and soi, not by distance, so the 3 km and 9 km radii are chosen to keep its named city-fringe corridors (Ratchadaphisek Soi 1 to 17, Rama 9, Phahonyothin Soi 1 to 15) in the fringe. That makes the CBD smaller than Knight Frank's, which errs conservative. The 40 km limit marks where the Bangkok tiers stop applying, and there the city fringe value is used`,
  },
  salePricePerSqm: {
    condo: {
      cbd: {
        value: 293_283,
        source: `${EDITABLE}; CBRE Thailand: "The average asking price of under-construction units in freehold condominium projects (High-end and above) in downtown Bangkok increased 2.5% Y-o-Y to THB 293,283 per square meter", ${CBRE_Q3_2026}. An asking price for new high-end projects, which most new CBD launches are; for a mid-market project compare Knight Frank's CBD average asking price over all listed condominiums of approximately THB 236,800 per m² in Q1 2026, ${KNIGHT_FRANK_Q1_2026}`,
      },
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
      source: `${EDITABLE}; asking and marketed prices per square wah reported by Colliers on 4 June 2026: "Land prices along sections of Ratchadaphisek Road have already exceeded 1 million baht per square wah" and Chidlom, Ploenchit and Wireless Road "currently range between 3 million and 4 million baht per square wah", ${COLLIERS_JUNE_2026}. Official reference, not a market price, with the road names read from a partly garbled Thai text layer and the figures read cleanly: the Treasury Department's appraised value for the 2023 to 2026 cycle (B.E. 2566 to 2569), the value transfer fees and taxes are charged on, is THB 1,000,000 per square wah on Phloen Chit Road and Witthayu (Wireless) Road, THB 750,000 to 900,000 on Ratchadamri Road and THB 400,000 to 1,000,000 on Rama I Road, ${TREASURY_BANGKOK_2566_2569}`,
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
      lowRise: LOW_RISE_STRUCTURE.substructure,
      highRise: HIGH_RISE_STRUCTURE.substructure,
    },
    superstructure: {
      lowRise: LOW_RISE_STRUCTURE.superstructure,
      highRise: HIGH_RISE_STRUCTURE.superstructure,
    },
    services: {
      condo: noBoiRow('condominium', { low: 7_000, high: 10_000 }),
      office: BOI_OFFICE_SERVICES,
      hotel: noBoiRow('hotel', { low: 13_000, high: 19_000 }),
    },
    basement: {
      ...BOI_BASEMENT_CAR_PARK,
      source: `${EDITABLE}; BOI car park, basement, ${band(BOI_BASEMENT_CAR_PARK)} per m², ${BOI_COSTS}. RHLB basement car park THB 19,500 to 23,500 per m², ${RHLB_COSTS}`,
    },
  },
} as const satisfies MoneyPrices

export const MONEY_REGIONS = {
  bkk: {
    currency: 'THB',
    landUnit: {
      name: 'square wah',
      sqm: { value: 4, source: 'Thai land measure: 1 rai = 400 square wah = 1,600 m², so 1 square wah = 4 m²; stated conversion, not fetched in research' },
    },
    oldLinkLandUnitSqm: null,
    landWarningFactor: LAND_WARNING_FACTOR,
    prices: BANGKOK_PRICES,
  },
  dxb: {
    currency: 'AED',
    landUnit: {
      name: 'm²',
      sqm: { value: 1, source: 'one square metre, the unit Dubai affection plans state areas in, as in the Trakhees site plan for International City plot IC1-CTYL-16_013 (12 May 2026): "GFA=4804.84 Sq. m"' },
    },
    oldLinkLandUnitSqm: {
      value: SQM_PER_SQFT,
      source: 'one square foot, from the international foot of exactly 0.3048 m: share links written before 20 Nov 2026, when Dubai land prices were entered per sq ft, carry them per sq ft',
    },
    landWarningFactor: LAND_WARNING_FACTOR,
    prices: null,
  },
  mum: {
    currency: 'INR',
    landUnit: {
      name: 'sq ft',
      sqm: { value: SQM_PER_SQFT, source: 'one square foot, from the international foot of exactly 0.3048 m; Mumbai areas are shown in square feet' },
    },
    oldLinkLandUnitSqm: null,
    landWarningFactor: LAND_WARNING_FACTOR,
    prices: null,
  },
  custom: {
    currency: null,
    landUnit: { name: 'm²', sqm: { value: 1, source: 'one square metre, the unit areas are shown in for custom rules' } },
    oldLinkLandUnitSqm: null,
    landWarningFactor: LAND_WARNING_FACTOR,
    prices: null,
  },
} as const satisfies Record<string, MoneyRegion>

export type RegionId = keyof typeof MONEY_REGIONS

type Term = { readonly value: string; readonly source: string }

export const PURCHASE_USE_ORDER =
  'assumption: a design pays only for the floor area it uses above the free cap (basic FSI and any area in lieu of a road strip), up to what is bought. Premium FSI and TDR may be used in any order, so that area is split between them in proportion to what is bought; fungible area, which sits on top of the permissible total, is used last'

export const CARPET_RATIO_NOTE =
  'For comparison only: the IGR Maharashtra Ready Reckoner guidelines for 2025-26 and 2026-27 (instruction 5) take built-up area as 1.1 × carpet area when valuing a flat for stamp duty, with balconies valued separately. That is a valuation rule, not a building rule, so it is not used here'

const DUBAI_BUILDING_CODE =
  'Dubai Municipality, Dubai Building Code, 2021 Edition, https://dmpmedia.dm.gov.ae/uploads/2021/12/Dubai%20Building%20Code_English_2021%20Edition_compressed.pdf'

const dbc = (page: number, quote: string) => `${DUBAI_BUILDING_CODE}, PDF page ${page}: "${quote}"`

export const AFFECTION_PLAN_TERMS = {
  document: {
    value: 'Affection plan',
    source: dbc(
      23,
      'Affection plan: Plan of the plot or site issued by the Authority, showing information that includes (but is not limited to) the plot boundaries, plot dimensions, plot areas, setbacks and surroundings as well as the land uses. Also called site plan.',
    ),
  },
  use: {
    value: 'Authorized use',
    source: dbc(
      23,
      'Authorized use: Plot use or building occupancy authorized according to the classification of lands in Dubai noted in the official affection plan or development regulation.',
    ),
  },
  fields: {
    maxGfaSqm: {
      value: 'Gross floor area (GFA)',
      source: dbc(6, 'Gross floor area (GFA): Measurement used by Planning Authorities in Dubai to define the floor area ratio (FAR), where FAR is the ratio of GFA to plot area.'),
    },
    maxFar: { value: 'Floor area ratio (FAR)', source: dbc(5, 'Floor area ratio (FAR): Ratio of gross floor area (GFA) to plot area.') },
    maxHeightM: {
      value: 'Building height',
      source: dbc(
        24,
        'Building height: Vertical distance measured from the approved road edge level at the plot main access to the mean finished level of the building roof.',
      ),
    },
    maxStoreys: {
      value: 'Floors',
      source: dbc(
        40,
        'the allowable number of floors, as defined by the affection plan or DCR ... Example: For a building with G+10 floors limit, the maximum allowable height shall be calculated as 11 (the number of floors)',
      ),
    },
    maxCoverageShare: {
      value: 'Plot coverage',
      source: dbc(30, 'Plot coverage: Horizontal area occupied by all main and annex buildings on the same plot'),
    },
    roadSetbackM: {
      value: 'Setback from road',
      source: dbc(41, 'Table B.1 Setback calculation table: Setback from neighbour (X) ... Setback from road; The building setback requirements in the affection plan or DCR shall take precedence'),
    },
    boundarySetbackM: {
      value: 'Setback from neighbour',
      source: dbc(41, 'Table B.1 Setback calculation table: Setback from neighbour (X) ... Setback from road; The building setback requirements in the affection plan or DCR shall take precedence'),
    },
    parkingSqmPerSpace: {
      value: 'Parking requirement',
      source: dbc(89, 'Parking requirements set out in the affection plan or DCR shall take precedent over Table B.13.'),
    },
  },
} as const satisfies { document: Term; use: Term; fields: Partial<Record<PlotLimitField, Term>> }

const DCPR_2034 =
  'Greater Mumbai Development Control and Promotion Regulations 2034, sanctioned text of 8 May 2018 (MCGM), https://portal.mcgm.gov.in/irj/go/km/docs/documents/MCGM%20Department%20List/Chief%20Engineer%20(Development%20Plan)/Docs/SANCTIONED%20DP2034/DCPR/DCPR%202034.pdf'

export const DCPR_RESIDENTIAL_USE = {
  value: 'Residential (R zone), Suburbs and Extended Suburbs',
  source: `${DCPR_2034}, PDF page 127, Reg 30(A)(1) Table 12 Sr II(iii): "The remaining area in Suburbs and Extended Suburbs, Residential/ Commercial"`,
} as const satisfies Term

export const MUMBAI_EXAMPLE_LAND_RATE: Assumption = {
  value: 64_240,
  source:
    'Department of Registration and Stamps, Government of Maharashtra, Annual Statement of Rates (Ready Reckoner) 2026-27, Mumbai Suburban district, village Mulund (W), open land ₹64,240 per m² in zone 123/567. The zone is matched by position and not confirmed for this plot: on OpenStreetMap the plot lies between L.B.S. Marg and Purushottam Kheraj Road, which zone 123/567 covers: "एल.बी.एस.मार्ग व पुरूषोत्तम खेराज रोड या मधील विभाग क्रमांक 123/568 मधील मिळकती सोडून उर्वरीत सर्व मिळकती" (all properties between L.B.S. Marg and Purushottam Kheraj Road except those of zone 123/568); if it lies in zone 123/568 the rate is ₹63,400. https://easr.igrmaharashtra.gov.in/eASRCommon.aspx?hDistName=Bombaymains, fetched 2026-11-20',
}

const DUBAI_APARTMENT_GROSS_SQM = ASSUMPTIONS.condoUnitSqm.value / ASSUMPTIONS.netToGross.condo.value

export const DUBAI_EXAMPLE_PARKING_SQM_PER_SPACE: Assumption = {
  value: DUBAI_APARTMENT_GROSS_SQM,
  source: `Parking from the Trakhees regulations the plan refers to: Trakhees (Ports, Customs and Free Zone Corporation), Building Regulation Design Guidelines, Architecture Book (Blue Code), February 2021, Section 15.3.1(c) Apartments: "One parking space for each apartment (studio or single bedroom) up to 150.0 square meters floor area", https://accreditation.trakhees.ae/regulations/BLUE_2021_FEB/files/basic-html/page143.html, fetched 2026-11-21. The rule counts apartments, so it is entered as floor area per space using the apartment these designs assume (${ASSUMPTIONS.condoUnitSqm.value} m² at ${ASSUMPTIONS.netToGross.condo.value * 100}% net to gross, ${Number(DUBAI_APARTMENT_GROSS_SQM.toFixed(1))} m² of floor area per apartment); larger apartments of two or more bedrooms need 1.5 to 3 spaces each under the same section`,
}

export const DUBAI_EXAMPLE_LIMITS_SOURCE = `Setbacks and plot coverage copied from a public Nakheel affection plan, not this plot’s own: Trakhees site plan issued 12 May 2026 for International City Phase 1 plot IC1-CTYL-16_013, mixed use (residential with retail), FAR 3.5: "Podium setback: 0.00m from all Sides; Tower setback: Front = 0.00m, Sides =:3.00m" and "Plot coverage: Podium: 100% , Tower : 60%"; the tower figures are used because these designs have no podium. That plan gives height in floors only, so height in metres stays blank, and for parking says "Refer to Trakhees Building & Design Regulations in parallel with the master developer's DCR". Published by the Consulate General of India, Dubai, https://www.cgidubai.gov.in/content/Affection-plan-Updated%20-IC1-CTYL-16_013_12.05.2026.pdf, fetched 2026-11-20. ${DUBAI_EXAMPLE_PARKING_SQM_PER_SPACE.source}`
