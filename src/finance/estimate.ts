import type { Metrics } from '@/designs'
import type { BuildingType } from '@/plot/plot'
import type { RulePack } from '@/rules'
import { isHighRiseOrExtraLarge, type MoneyRegion, type Solution } from '@/solve'
import type { Bound, RateRow } from './parameters'
import type { Values } from './values'

export type BuildClass = 'lowRise' | 'highRise'

export type FinanceSite = {
  readonly pack: RulePack
  readonly use: BuildingType
  readonly plotAreaSqm: number
  readonly landUnitSqm: number
}

export const financeSite = (solution: Solution, region: MoneyRegion): FinanceSite => ({
  pack: solution.pack,
  use: solution.plot.buildingType,
  plotAreaSqm: solution.site.areaSqm,
  landUnitSqm: region.landUnit.sqm.value,
})

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
}

const LEVEL_TOLERANCE = 1e-6

const levelsFor = (areaSqm: number, plateSqm: number) => (plateSqm > 0 ? Math.max(0, Math.ceil(areaSqm / plateSqm - LEVEL_TOLERANCE)) : 0)

export const totalOf = ({ substructure, superstructure, services }: CostSplit) => substructure + superstructure + services

function parkingFor(metrics: Metrics, plotAreaSqm: number, maxAboveGround: number): Parking {
  const needed = levelsFor(metrics.parkingSqm, metrics.footprintSqm)
  const basementSqm = Math.max(0, metrics.parkingSqm - maxAboveGround * metrics.footprintSqm)
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

export function estimate(metrics: Metrics, site: FinanceSite, values: Values): Estimate {
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
  const landAfter = (cost: CostSplit) => grossValue * (1 - values.margin) - totalOf(cost) * (1 + values.softCost)
  const landValue = { low: landAfter(firstCost.high), high: landAfter(firstCost.low) }
  const landUnits = site.plotAreaSqm / site.landUnitSqm
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
  }
}
