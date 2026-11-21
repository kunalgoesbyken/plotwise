import { z } from 'zod'
import { BUILDING_TYPES, type BuildingType } from '@/plot/plot'
import type { RulePack } from '@/rules'
import type { AreaTier, AssumedRange, ExampleMoney, GenericMoney, LocalMoney, SplitRange } from '@/solve'

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
export type PurchasePriceId = 'landRate' | 'tdrPrice'

export type Assumed = { readonly value: number; readonly source: string }
export type ExampleAssumed = Assumed & { readonly kind: 'example' | 'split' }
export type Basis = { readonly use: BuildingType; readonly tier: AreaTier }

export type Input = { readonly id: ParameterId | PurchasePriceId; readonly unit: Unit; readonly perUse: boolean }

type GenericParameter = { readonly block: 'generic'; readonly generic: (money: GenericMoney, use: BuildingType) => Assumed }

type LocalParameter = {
  readonly block: 'local'
  readonly local: (money: LocalMoney, basis: Basis) => Assumed
  readonly example: (money: ExampleMoney, use: BuildingType) => ExampleAssumed | null
}

export type Parameter = Input & { readonly id: ParameterId } & (GenericParameter | LocalParameter)

export type PurchasePrice = Input & { readonly id: PurchasePriceId }

export const PURCHASE_PRICES: Readonly<Record<PurchasePriceId, PurchasePrice>> = {
  landRate: { id: 'landRate', unit: 'money', perUse: false },
  tdrPrice: { id: 'tdrPrice', unit: 'money', perUse: false },
}

export const isParameter = (input: Input): input is Parameter => 'block' in input

export const isPurchasePrice = (input: Input): input is PurchasePrice => Object.hasOwn(PURCHASE_PRICES, input.id)

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

type RateRanges = {
  readonly local: (money: LocalMoney, use: BuildingType) => AssumedRange
  readonly example: (money: ExampleMoney, use: BuildingType) => SplitRange | undefined
}

const RATE_RANGES: Readonly<Record<RateRow, RateRanges>> = {
  'substructure.lowRise': { local: (money) => money.rates.substructure.lowRise, example: (money) => money.rates.substructure },
  'substructure.highRise': { local: (money) => money.rates.substructure.highRise, example: (money) => money.rates.substructure },
  'superstructure.lowRise': { local: (money) => money.rates.superstructure.lowRise, example: (money) => money.rates.superstructure },
  'superstructure.highRise': { local: (money) => money.rates.superstructure.highRise, example: (money) => money.rates.superstructure },
  services: { local: (money, use) => money.rates.services[use], example: (money, use) => money.rates.services[use] },
  basement: { local: (money) => money.rates.basement, example: () => undefined },
}

const boundOf = (range: AssumedRange, bound: Bound): Assumed => ({ value: range[bound], source: range.source })

const asExample = (assumed: Assumed): ExampleAssumed => ({ ...assumed, kind: 'example' })

const splitBound = (range: SplitRange | undefined, bound: Bound): ExampleAssumed | null => (range ? { ...boundOf(range, bound), kind: range.kind } : null)

const generic = (id: ScalarId, unit: Unit, perUse: boolean, assumed: GenericParameter['generic']): Parameter => ({ id, unit, perUse, block: 'generic', generic: assumed })

const referenceParameter = (id: ScalarId, bound: Bound): Parameter => ({
  id,
  unit: 'landMoney',
  perUse: false,
  block: 'local',
  local: (money, { tier }) => boundOf(money.landReferencePerUnit[tier], bound),
  example: (money) => asExample(boundOf(money.landReferencePerUnit, bound)),
})

export const SCALARS: Readonly<Record<ScalarId, Parameter>> = {
  salePrice: {
    id: 'salePrice',
    unit: 'money',
    perUse: true,
    block: 'local',
    local: (money, { use, tier }) => money.salePricePerSqm[use][tier],
    example: (money, use) => {
      const price = money.salePricePerSqm[use]
      return price ? asExample(price) : null
    },
  },
  saleableShare: generic('saleableShare', 'share', true, (money, use) => money.saleableShare[use]),
  margin: generic('margin', 'share', false, (money) => money.developerMargin),
  softCost: generic('softCost', 'share', false, (money) => money.softCostShare),
  parkingLevels: generic('parkingLevels', 'count', false, (money) => money.maxAboveGroundParkingLevels),
  transferCosts: generic('transferCosts', 'share', false, (money) => money.transferCostShare),
  holdingCost: generic('holdingCost', 'share', false, (money) => money.holdingCostShare),
  landFinance: generic('landFinance', 'share', false, (money) => money.landFinanceShare),
  landReferenceLow: referenceParameter('landReferenceLow', 'low'),
  landReferenceHigh: referenceParameter('landReferenceHigh', 'high'),
}

const rateParameter = (row: RateRow, bound: Bound): Parameter => ({
  id: `${row}.${bound}`,
  unit: 'money',
  perUse: row === 'services',
  block: 'local',
  local: (money, { use }) => boundOf(RATE_RANGES[row].local(money, use), bound),
  example: (money, use) => splitBound(RATE_RANGES[row].example(money, use), bound),
})

export type RateParameters = { readonly row: RateRow; readonly low: Parameter; readonly high: Parameter }

export const RATES: readonly RateParameters[] = RATE_ROWS.map((row) => ({
  row,
  low: rateParameter(row, 'low'),
  high: rateParameter(row, 'high'),
}))

export const PARAMETERS: readonly Parameter[] = [...Object.values(SCALARS), ...RATES.flatMap(({ low, high }) => [low, high])]

const ONE_CLASS_ROW: Readonly<Partial<Record<RateRow, RateRow>>> = {
  'substructure.highRise': 'substructure.lowRise',
  'superstructure.highRise': 'superstructure.lowRise',
}

const ONE_CLASS_RATES: ReadonlyMap<ParameterId, Parameter> = new Map(
  RATES.flatMap(({ row, low, high }) => {
    const rates = RATES.find((rate) => rate.row === ONE_CLASS_ROW[row])
    return rates ? [[low.id, rates.low] as const, [high.id, rates.high] as const] : []
  }),
)

export const enteredAs = (parameter: Parameter, { buildingClasses }: RulePack): Parameter =>
  buildingClasses ? parameter : (ONE_CLASS_RATES.get(parameter.id) ?? parameter)

export const parametersFor = (pack: RulePack): readonly Parameter[] => PARAMETERS.filter((parameter) => enteredAs(parameter, pack) === parameter)

export const ratesFor = (pack: RulePack): readonly RateParameters[] => RATES.filter(({ low }) => enteredAs(low, pack) === low)

export const storageKey = ({ id, perUse }: Input, use: BuildingType) => (perUse ? `${id}.${use}` : id)

export const STORAGE_KEYS: ReadonlyMap<string, Input> = new Map(
  [...PARAMETERS, ...Object.values(PURCHASE_PRICES)].flatMap((input) =>
    input.perUse ? BUILDING_TYPES.map((use) => [storageKey(input, use), input] as const) : [[input.id, input] as const],
  ),
)

export const isValidValue = ({ unit }: Input, value: number) => UNIT_SCHEMAS[unit].safeParse(value).success
