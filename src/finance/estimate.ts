import type { Metrics } from '@/designs'
import type { LngLat } from '@/geo/projection'
import type { BuildingType } from '@/plot/plot'
import type { FarPurchase, RulePack } from '@/rules'
import { isHighRiseOrExtraLarge, purchaseUse, type Limits, type LocalMoney, type MoneyRegion, type PurchaseOption, type Solution } from '@/solve'
import { placementOf, type Placement } from './area'
import type { Bound, PurchasePriceId, RateRow } from './parameters'
import type { MoneySite, Values } from './values'

export type BuildClass = 'lowRise' | 'highRise'

export type FinanceSite = {
  readonly pack: RulePack
  readonly use: BuildingType
  readonly origin: LngLat
  readonly plotAreaSqm: number
  readonly landUnitSqm: number
  readonly farLimits: Limits
}

export const landUnitsOf = ({ plotAreaSqm, landUnitSqm }: FinanceSite) => plotAreaSqm / landUnitSqm

export type PurchasePrices = Readonly<Partial<Record<PurchasePriceId, number>>>

export const financeSite = (solution: Solution, region: MoneyRegion): FinanceSite => ({
  pack: solution.pack,
  use: solution.plot.buildingType,
  origin: solution.site.frame.origin,
  plotAreaSqm: solution.landAreaSqm,
  landUnitSqm: region.landUnit.sqm.value,
  farLimits: solution.limits,
})

function priceInputOf(price: FarPurchase['price']): PurchasePriceId | null {
  switch (price.kind) {
    case 'shareOfLandRate':
      return 'landRate'
    case 'userSupplied':
      return 'tdrPrice'
    case 'perSqm':
      return null
  }
}

const pricesOf = (options: readonly PurchaseOption[]): PurchasePriceId[] => [...new Set(options.flatMap((option) => priceInputOf(option.price) ?? []))]

export const neededPrices = ({ farLimits }: FinanceSite) => pricesOf(farLimits.farPurchase.options.filter((option) => option.chosenGfaSqm > 0))

export const offeredPrices = ({ farLimits }: FinanceSite) => pricesOf(farLimits.farPurchase.options.filter((option) => option.maxExtraGfaSqm > 0))

function pricePerSqm(price: FarPurchase['price'], prices: PurchasePrices): number {
  switch (price.kind) {
    case 'shareOfLandRate':
      return price.share.value * (prices.landRate ?? Number.NaN)
    case 'userSupplied':
      return prices.tdrPrice ?? Number.NaN
    case 'perSqm':
      return price.value.value
  }
}

const purchaseCost = (metrics: Metrics, { farLimits }: FinanceSite, prices: PurchasePrices) =>
  purchaseUse(farLimits, metrics.gfaSqm).reduce((sum, use) => (use.usedGfaSqm > 0 ? sum + use.usedGfaSqm * pricePerSqm(use.price, prices) : sum), 0)

export const placementIn = ({ origin }: FinanceSite, local: LocalMoney): Placement => placementOf(origin, local.areas)

export const moneySiteOf = (site: FinanceSite, { local }: MoneyRegion): MoneySite => ({ pack: site.pack, use: site.use, tier: local && placementIn(site, local).tier })

export type CostSplit = { readonly substructure: number; readonly superstructure: number; readonly services: number }
export type Range = { readonly low: number; readonly high: number }

export type Parking = { readonly levelsAboveGround: number; readonly basementLevels: number; readonly basementSqm: number }

export type Estimate = {
  readonly buildClass: BuildClass
  readonly builtSqm: number
  readonly grossSqm: number
  readonly parkingSqm: number
  readonly saleableSqm: number
  readonly parking: Parking
  readonly firstCost: { readonly low: CostSplit; readonly high: CostSplit }
  readonly grossValue: number
  readonly landValue: Range
  readonly landValuePerUnit: Range
  readonly purchaseCost: number
}

const LEVEL_TOLERANCE = 1e-6

const levelsFor = (areaSqm: number, plateSqm: number) => (plateSqm > 0 ? Math.max(0, Math.ceil(areaSqm / plateSqm - LEVEL_TOLERANCE)) : 0)

export const totalOf = ({ substructure, superstructure, services }: CostSplit) => substructure + superstructure + services

export const acquisitionShare = ({ transferCosts, holdingCost, landFinance }: Values) => transferCosts + holdingCost + landFinance

export function landResidual(grossValue: number, buildCost: number, values: Values, purchaseCost = 0) {
  const afterBuild = grossValue * (1 - values.margin) - buildCost * (1 + values.softCost) - purchaseCost
  return afterBuild < 0 ? afterBuild : afterBuild / (1 + acquisitionShare(values))
}

const basementSqmOf = ({ parkingSqm, footprintSqm }: Metrics, maxAboveGround: number) => Math.max(0, parkingSqm - maxAboveGround * footprintSqm)

export const needsBasement = (metrics: readonly Metrics[], maxAboveGround: number) => metrics.some((design) => basementSqmOf(design, maxAboveGround) > 0)

function parkingFor(metrics: Metrics, plotAreaSqm: number, maxAboveGround: number): Parking {
  const needed = levelsFor(metrics.parkingSqm, metrics.footprintSqm)
  const basementSqm = basementSqmOf(metrics, maxAboveGround)
  return {
    levelsAboveGround: Math.min(needed, maxAboveGround),
    basementLevels: levelsFor(basementSqm, plotAreaSqm),
    basementSqm,
  }
}

function costAt(bound: Bound, buildClass: BuildClass, aboveGroundSqm: number, basementSqm: number, values: Values): CostSplit {
  const rate = (row: RateRow) => values[`${row}.${bound}`]
  return {
    substructure: aboveGroundSqm * rate(`substructure.${buildClass}`) + basementSqm * rate('basement'),
    superstructure: aboveGroundSqm * rate(`superstructure.${buildClass}`),
    services: aboveGroundSqm * rate('services'),
  }
}

export function estimate(metrics: Metrics, site: FinanceSite, values: Values, prices: PurchasePrices = {}): Estimate {
  const buildClass = isHighRiseOrExtraLarge(site.pack, { heightM: metrics.heightM, storeys: metrics.storeys, floorAreaSqm: metrics.builtSqm })
    ? 'highRise'
    : 'lowRise'
  const parking = parkingFor(metrics, site.plotAreaSqm, values.parkingLevels)
  const aboveGroundSqm = metrics.builtSqm - parking.basementSqm
  const atLow = costAt('low', buildClass, aboveGroundSqm, parking.basementSqm, values)
  const atHigh = costAt('high', buildClass, aboveGroundSqm, parking.basementSqm, values)
  const firstCost = totalOf(atLow) <= totalOf(atHigh) ? { low: atLow, high: atHigh } : { low: atHigh, high: atLow }
  const saleableSqm = Math.max(0, metrics.builtSqm - metrics.parkingSqm) * values.saleableShare
  const grossValue = saleableSqm * values.salePrice
  const bought = purchaseCost(metrics, site, prices)
  const landFor = (cost: CostSplit) => landResidual(grossValue, totalOf(cost), values, bought)
  const landValue = { low: landFor(firstCost.high), high: landFor(firstCost.low) }
  const landUnits = landUnitsOf(site)
  return {
    buildClass,
    builtSqm: metrics.builtSqm,
    grossSqm: metrics.gfaSqm,
    parkingSqm: metrics.parkingSqm,
    saleableSqm,
    parking,
    firstCost,
    grossValue,
    landValue,
    landValuePerUnit: { low: landValue.low / landUnits, high: landValue.high / landUnits },
    purchaseCost: bought,
  }
}
