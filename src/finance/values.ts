import type { BuildingType } from '@/plot/plot'
import type { MoneyRegion } from '@/solve'
import { PARAMETERS, storageKey, type ParameterId } from './parameters'

export type Overrides = Readonly<Partial<Record<string, number>>>
export type Values = Readonly<Record<ParameterId, number>>

export function resolveValues(region: MoneyRegion, use: BuildingType, overrides: Overrides): Values {
  const entries = PARAMETERS.map((parameter) => [parameter.id, overrides[storageKey(parameter, use)] ?? parameter.assumed(region, use).value])
  return Object.fromEntries(entries) as Values
}
