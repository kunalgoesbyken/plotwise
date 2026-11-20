import type { MoneyRegion } from '@/solve'
import { PARAMETERS, storageKey, type Basis, type ParameterId } from './parameters'

export type Overrides = Readonly<Partial<Record<string, number>>>
export type Values = Readonly<Record<ParameterId, number>>

export function resolveValues(region: MoneyRegion, basis: Basis, overrides: Overrides): Values {
  const entries = PARAMETERS.map((parameter) => [parameter.id, overrides[storageKey(parameter, basis.use)] ?? parameter.assumed(region, basis).value])
  return Object.fromEntries(entries) as Values
}
