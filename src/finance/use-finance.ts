'use client'

import { useMemo } from 'react'
import type { Design } from '@/designs'
import { useFeasibility } from '@/feasibility/feasibility-provider'
import type { BuildingType } from '@/plot/plot'
import type { MoneyRegion } from '@/solve'
import type { Placement } from './area'
import { useAssumptions } from './assumptions-provider'
import { basisOf, estimate, financeSite, type Estimate } from './estimate'
import { landCheck, type LandCheck } from './land-check'
import { storageKey, type Parameter } from './parameters'
import { resolveValues, type Values } from './values'

export type Finance = {
  readonly region: MoneyRegion
  readonly use: BuildingType
  readonly area: Placement
  readonly values: Values
  readonly hasEdits: boolean
  readonly estimateFor: (design: Design) => Estimate
  readonly landCheckOf: (estimate: Estimate) => LandCheck
  readonly valueOf: (parameter: Parameter) => number
  readonly sourceOf: (parameter: Parameter) => string
  readonly edit: (parameter: Parameter, value: number) => void
  readonly resetAll: () => void
}

export function useFinance(): Finance | null {
  const { result } = useFeasibility()
  const { region, overrides, setOverride, clearAll } = useAssumptions()
  const solution = result?.status === 'ready' ? result.solution : null
  const site = useMemo(() => solution && financeSite(solution, region), [solution, region])
  const values = useMemo(() => site && resolveValues(region, basisOf(site), overrides), [site, region, overrides])
  return useMemo(() => {
    if (!site || !values) return null
    const { use, area } = site
    const basis = basisOf(site)
    return {
      region,
      use,
      area,
      values,
      hasEdits: Object.keys(overrides).length > 0,
      estimateFor: (design) => estimate(design.metrics, site, values),
      landCheckOf: ({ landValuePerUnit }) => landCheck(landValuePerUnit, values, region.landWarningFactor.value),
      valueOf: (parameter) => values[parameter.id],
      sourceOf: (parameter) => parameter.assumed(region, basis).source,
      edit: (parameter, value) => setOverride(storageKey(parameter, use), value),
      resetAll: clearAll,
    }
  }, [site, values, region, overrides, setOverride, clearAll])
}
