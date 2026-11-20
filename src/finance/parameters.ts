import { z } from 'zod'
import { BUILDING_TYPES, type BuildingType } from '@/plot/plot'
import type { AreaTier, AssumedRange, MoneyPrices } from '@/solve'

export type Unit = 'money' | 'landMoney' | 'share' | 'count'
export type RateRow = 'substructure.lowRise' | 'substructure.highRise' | 'superstructure.lowRise' | 'superstructure.highRise' | 'services' | 'basement'
export type Bound = 'low' | 'high'
export type ScalarId =
  | 'salePrice'
  | 'saleableShare'
  | 'margin'
  | 'softCost'
  | 'parkingLevels'
  | 'transferCosts'
  | 'holdingCost'
  | 'landFinance'
  | 'landReferenceLow'
  | 'landReferenceHigh'
export type ParameterId = ScalarId | `${RateRow}.${Bound}`

export type Assumed = { readonly value: number; readonly source: string }
export type Basis = { readonly use: BuildingType; readonly tier: AreaTier }

export type Parameter = {
  readonly id: ParameterId
  readonly unit: Unit
  readonly perUse: boolean
  readonly assumed: (prices: MoneyPrices, basis: Basis) => Assumed
}

export const RATE_ROWS: readonly RateRow[] = [
  'substructure.lowRise',
  'substructure.highRise',
  'superstructure.lowRise',
  'superstructure.highRise',
  'services',
  'basement',
]

const MAX_MONEY = 1_000_000_000
const MAX_PARKING_LEVELS = 30

const UNIT_SCHEMAS: Readonly<Record<Unit, z.ZodNumber>> = {
  money: z.number().min(0).max(MAX_MONEY),
  landMoney: z.number().min(0).max(MAX_MONEY),
  share: z.number().min(0).max(1),
  count: z.number().int().min(0).max(MAX_PARKING_LEVELS),
}

const RATE_RANGES: Readonly<Record<RateRow, (prices: MoneyPrices, use: BuildingType) => AssumedRange>> = {
  'substructure.lowRise': (prices) => prices.rates.substructure.lowRise,
  'substructure.highRise': (prices) => prices.rates.substructure.highRise,
  'superstructure.lowRise': (prices) => prices.rates.superstructure.lowRise,
  'superstructure.highRise': (prices) => prices.rates.superstructure.highRise,
  services: (prices, use) => prices.rates.services[use],
  basement: (prices) => prices.rates.basement,
}

const referenceParameter = (id: ScalarId, bound: Bound): Parameter => ({
  id,
  unit: 'landMoney',
  perUse: false,
  assumed: (prices, { tier }) => {
    const range = prices.landReferencePerUnit[tier]
    return { value: range[bound], source: range.source }
  },
})

export const SCALARS: Readonly<Record<ScalarId, Parameter>> = {
  salePrice: { id: 'salePrice', unit: 'money', perUse: true, assumed: (prices, { use, tier }) => prices.salePricePerSqm[use][tier] },
  saleableShare: { id: 'saleableShare', unit: 'share', perUse: true, assumed: (prices, { use }) => prices.saleableShare[use] },
  margin: { id: 'margin', unit: 'share', perUse: false, assumed: (prices) => prices.developerMargin },
  softCost: { id: 'softCost', unit: 'share', perUse: false, assumed: (prices) => prices.softCostShare },
  parkingLevels: { id: 'parkingLevels', unit: 'count', perUse: false, assumed: (prices) => prices.maxAboveGroundParkingLevels },
  transferCosts: { id: 'transferCosts', unit: 'share', perUse: false, assumed: (prices) => prices.transferCostShare },
  holdingCost: { id: 'holdingCost', unit: 'share', perUse: false, assumed: (prices) => prices.holdingCostShare },
  landFinance: { id: 'landFinance', unit: 'share', perUse: false, assumed: (prices) => prices.landFinanceShare },
  landReferenceLow: referenceParameter('landReferenceLow', 'low'),
  landReferenceHigh: referenceParameter('landReferenceHigh', 'high'),
}

const rateParameter = (row: RateRow, bound: Bound): Parameter => ({
  id: `${row}.${bound}`,
  unit: 'money',
  perUse: row === 'services',
  assumed: (prices, { use }) => {
    const range = RATE_RANGES[row](prices, use)
    return { value: range[bound], source: range.source }
  },
})

export type RateParameters = { readonly row: RateRow; readonly low: Parameter; readonly high: Parameter }

export const RATES: readonly RateParameters[] = RATE_ROWS.map((row) => ({
  row,
  low: rateParameter(row, 'low'),
  high: rateParameter(row, 'high'),
}))

export const PARAMETERS: readonly Parameter[] = [...Object.values(SCALARS), ...RATES.flatMap(({ low, high }) => [low, high])]

export const storageKey = ({ id, perUse }: Parameter, use: BuildingType) => (perUse ? `${id}.${use}` : id)

export const STORAGE_KEYS: ReadonlyMap<string, Parameter> = new Map(
  PARAMETERS.flatMap((parameter) =>
    parameter.perUse ? BUILDING_TYPES.map((use) => [storageKey(parameter, use), parameter] as const) : [[parameter.id, parameter] as const],
  ),
)

export const isValidValue = ({ unit }: Parameter, value: number) => UNIT_SCHEMAS[unit].safeParse(value).success
