import { z } from 'zod'
import { BUILDING_TYPES, type BuildingType } from '@/plot/plot'
import type { AssumedRange, MoneyRegion } from '@/solve'

export type Unit = 'money' | 'share' | 'count'
export type RateRow = 'substructure.lowRise' | 'substructure.highRise' | 'superstructure.lowRise' | 'superstructure.highRise' | 'services' | 'basement'
export type Bound = 'low' | 'high'
export type ScalarId = 'salePrice' | 'saleableShare' | 'margin' | 'softCost' | 'parkingLevels'
export type ParameterId = ScalarId | `${RateRow}.${Bound}`

export type Assumed = { readonly value: number; readonly source: string }

export type Parameter = {
  readonly id: ParameterId
  readonly unit: Unit
  readonly perUse: boolean
  readonly assumed: (region: MoneyRegion, use: BuildingType) => Assumed
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
  share: z.number().min(0).max(1),
  count: z.number().int().min(0).max(MAX_PARKING_LEVELS),
}

const RATE_RANGES: Readonly<Record<RateRow, (region: MoneyRegion, use: BuildingType) => AssumedRange>> = {
  'substructure.lowRise': (region) => region.rates.substructure.lowRise,
  'substructure.highRise': (region) => region.rates.substructure.highRise,
  'superstructure.lowRise': (region) => region.rates.superstructure.lowRise,
  'superstructure.highRise': (region) => region.rates.superstructure.highRise,
  services: (region, use) => region.rates.services[use],
  basement: (region) => region.rates.basement,
}

export const SCALARS: Readonly<Record<ScalarId, Parameter>> = {
  salePrice: { id: 'salePrice', unit: 'money', perUse: true, assumed: (region, use) => region.salePricePerSqm[use] },
  saleableShare: { id: 'saleableShare', unit: 'share', perUse: true, assumed: (region, use) => region.saleableShare[use] },
  margin: { id: 'margin', unit: 'share', perUse: false, assumed: (region) => region.developerMargin },
  softCost: { id: 'softCost', unit: 'share', perUse: false, assumed: (region) => region.softCostShare },
  parkingLevels: { id: 'parkingLevels', unit: 'count', perUse: false, assumed: (region) => region.maxAboveGroundParkingLevels },
}

const rateParameter = (row: RateRow, bound: Bound): Parameter => ({
  id: `${row}.${bound}`,
  unit: 'money',
  perUse: row === 'services',
  assumed: (region, use) => {
    const range = RATE_RANGES[row](region, use)
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
