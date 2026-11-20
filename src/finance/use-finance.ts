'use client'

import { useMemo } from 'react'
import type { Design } from '@/designs'
import { useFeasibility } from '@/feasibility/feasibility-provider'
import type { BuildingType } from '@/plot/plot'
import type { MoneyRegion } from '@/solve'
import type { Placement } from './area'
import { useAssumptions } from './assumptions-provider'
import { basisOf, estimate, financeSite, neededPrices, placementIn, type Estimate, type FinanceSite, type PurchasePrices } from './estimate'
import { landCheck, type LandCheck } from './land-check'
import { PURCHASE_PRICES, storageKey, type Input, type Parameter, type PurchasePrice } from './parameters'
import { enteredValues, missingParameters, packDefaults, resolveValues, type Defaults, type Overrides, type Values } from './values'

export type Priced = {
  readonly values: Values
  readonly estimateFor: (design: Design) => Estimate
  readonly landCheckOf: (estimate: Estimate) => LandCheck
}

export type Finance = {
  readonly region: MoneyRegion
  readonly use: BuildingType
  readonly area: Placement | null
  readonly hasEdits: boolean
  readonly missing: readonly Input[]
  readonly purchasePrices: readonly PurchasePrice[]
  readonly priced: Priced | null
  readonly valueOf: (input: Input) => number | null
  readonly sourceOf: (parameter: Parameter) => string | null
  readonly edit: (input: Input, value: number) => void
  readonly resetAll: () => void
}

function valuesFor(region: MoneyRegion, site: FinanceSite, overrides: Overrides, defaults: Defaults): Values | null {
  return region.prices ? resolveValues(region.prices, basisOf(site, region.prices), overrides) : enteredValues(overrides, site.use, defaults)
}

function pricedBy(region: MoneyRegion, site: FinanceSite, values: Values | null, prices: PurchasePrices | null): Priced | null {
  if (!values || !prices) return null
  return {
    values,
    estimateFor: (design) => estimate(design.metrics, site, values, prices),
    landCheckOf: ({ landValuePerUnit }) => landCheck(landValuePerUnit, values, region.landWarningFactor.value),
  }
}

export function useFinance(): Finance | null {
  const { result } = useFeasibility()
  const { region, overrides, setOverride, clearAll } = useAssumptions()
  const solution = result?.status === 'ready' ? result.solution : null
  const site = useMemo(() => solution && financeSite(solution, region), [solution, region])
  return useMemo(() => {
    if (!site) return null
    const { prices } = region
    const defaults = packDefaults(site.pack)
    const values = valuesFor(region, site, overrides, defaults)
    const entered = (input: Input) => overrides[storageKey(input, site.use)]
    const purchasePrices = neededPrices(site).map((id) => PURCHASE_PRICES[id])
    const missingPrices = purchasePrices.filter((input) => entered(input) === undefined)
    const boughtPrices = Object.fromEntries(purchasePrices.map((input) => [input.id, entered(input)]))
    return {
      region,
      use: site.use,
      area: prices && placementIn(site, prices),
      hasEdits: Object.keys(overrides).length > 0,
      missing: [...(prices ? [] : missingParameters(overrides, site.use, defaults)), ...missingPrices],
      purchasePrices,
      priced: pricedBy(region, site, values, missingPrices.length === 0 ? boughtPrices : null),
      valueOf: (input) => entered(input) ?? (values && input.id in values ? values[input.id as Parameter['id']] : null) ?? defaults[input.id as Parameter['id']]?.value ?? null,
      sourceOf: (parameter) => (prices ? parameter.assumed(prices, basisOf(site, prices)).source : (defaults[parameter.id]?.source ?? null)),
      edit: (input, value) => setOverride(storageKey(input, site.use), value),
      resetAll: clearAll,
    }
  }, [site, region, overrides, setOverride, clearAll])
}
