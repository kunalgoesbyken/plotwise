'use client'

import { useMemo } from 'react'
import type { Design } from '@/designs'
import { useFeasibility } from '@/feasibility/feasibility-provider'
import type { BuildingType } from '@/plot/plot'
import type { MoneyRegion } from '@/solve'
import { useAssumptions } from './assumptions-provider'
import { estimate, type Estimate, type FinanceSite } from './estimate'
import { storageKey, type Parameter } from './parameters'
import { resolveValues, type Values } from './values'

export type Finance = {
  readonly region: MoneyRegion
  readonly use: BuildingType
  readonly values: Values
  readonly hasEdits: boolean
  readonly estimateFor: (design: Design) => Estimate
  readonly valueOf: (parameter: Parameter) => number
  readonly sourceOf: (parameter: Parameter) => string
  readonly edit: (parameter: Parameter, value: number) => void
  readonly resetAll: () => void
}

export function useFinance(): Finance | null {
  const { result } = useFeasibility()
  const { region, overrides, setOverride, clearAll } = useAssumptions()
  const solution = result?.status === 'ready' ? result.solution : null
  const use = solution?.plot.buildingType
  const values = useMemo(() => use && resolveValues(region, use, overrides), [region, use, overrides])
  return useMemo(() => {
    if (!solution || !use || !values) return null
    const site: FinanceSite = {
      pack: solution.pack,
      use,
      plotAreaSqm: solution.site.areaSqm,
      landUnitSqm: region.landUnit.sqm.value,
    }
    return {
      region,
      use,
      values,
      hasEdits: Object.keys(overrides).length > 0,
      estimateFor: (design) => estimate(design.metrics, site, values),
      valueOf: (parameter) => values[parameter.id],
      sourceOf: (parameter) => parameter.assumed(region, use).source,
      edit: (parameter, value) => setOverride(storageKey(parameter, use), value),
      resetAll: clearAll,
    }
  }, [solution, use, values, region, overrides, setOverride, clearAll])
}
