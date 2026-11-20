import type { BuildingType } from '@/plot/plot'
import type { MoneyPrices } from '@/solve'
import { PARAMETERS, storageKey, type Basis, type Parameter, type ParameterId } from './parameters'

export type Overrides = Readonly<Partial<Record<string, number>>>
export type Values = Readonly<Record<ParameterId, number>>

export function resolveValues(prices: MoneyPrices, basis: Basis, overrides: Overrides): Values {
  const entries = PARAMETERS.map((parameter) => [parameter.id, overrides[storageKey(parameter, basis.use)] ?? parameter.assumed(prices, basis).value])
  return Object.fromEntries(entries) as Values
}

export const missingParameters = (overrides: Overrides, use: BuildingType): readonly Parameter[] =>
  PARAMETERS.filter((parameter) => overrides[storageKey(parameter, use)] === undefined)

export function enteredValues(overrides: Overrides, use: BuildingType): Values | null {
  if (missingParameters(overrides, use).length > 0) return null
  return Object.fromEntries(PARAMETERS.map((parameter) => [parameter.id, overrides[storageKey(parameter, use)]])) as Values
}
