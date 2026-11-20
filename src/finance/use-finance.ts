'use client'

import { useMemo } from 'react'
import type { Design } from '@/designs'
import { useFeasibility } from '@/feasibility/feasibility-provider'
import type { BuildingType } from '@/plot/plot'
import type { MoneyRegion } from '@/solve'
import type { Placement } from './area'
import { useAssumptions } from './assumptions-provider'
import { basisOf, estimate, financeSite, placementIn, type Estimate, type FinanceSite } from './estimate'
import { landCheck, type LandCheck } from './land-check'
import { storageKey, type Parameter } from './parameters'
import { enteredValues, missingParameters, resolveValues, type Overrides, type Values } from './values'

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
  readonly missing: readonly Parameter[]
  readonly priced: Priced | null
  readonly valueOf: (parameter: Parameter) => number | null
  readonly sourceOf: (parameter: Parameter) => string | null
  readonly edit: (parameter: Parameter, value: number) => void
  readonly resetAll: () => void
}

function valuesFor(region: MoneyRegion, site: FinanceSite, overrides: Overrides): Values | null {
  return region.prices ? resolveValues(region.prices, basisOf(site, region.prices), overrides) : enteredValues(overrides, site.use)
}

function pricedBy(region: MoneyRegion, site: FinanceSite, values: Values | null): Priced | null {
  if (!values) return null
  return {
    values,
    estimateFor: (design) => estimate(design.metrics, site, values),
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
    const values = valuesFor(region, site, overrides)
    const entered = (parameter: Parameter) => overrides[storageKey(parameter, site.use)]
    return {
      region,
      use: site.use,
      area: prices && placementIn(site, prices),
      hasEdits: Object.keys(overrides).length > 0,
      missing: prices ? [] : missingParameters(overrides, site.use),
      priced: pricedBy(region, site, values),
      valueOf: (parameter) => values?.[parameter.id] ?? entered(parameter) ?? null,
      sourceOf: (parameter) => (prices ? parameter.assumed(prices, basisOf(site, prices)).source : null),
      edit: (parameter, value) => setOverride(storageKey(parameter, site.use), value),
      resetAll: clearAll,
    }
  }, [site, region, overrides, setOverride, clearAll])
}
