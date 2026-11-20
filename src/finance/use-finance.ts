'use client'

import { useMemo } from 'react'
import type { Design } from '@/designs'
import { useRegion } from '@/editor/plot-store'
import { useFeasibility } from '@/feasibility/feasibility-provider'
import type { BuildingType, Plot } from '@/plot/plot'
import { isExampleSite, type Region } from '@/region/regions'
import type { Assumption } from '@/site/assumptions'
import type { MoneyRegion } from '@/solve'
import type { Placement } from './area'
import { useAssumptions } from './assumptions-provider'
import { basisOf, estimate, financeSite, neededPrices, offeredPrices, placementIn, type Estimate, type FinanceSite, type PurchasePrices } from './estimate'
import { landCheck, type LandCheck } from './land-check'
import { PURCHASE_PRICES, ratesFor, storageKey, type Input, type Parameter, type PurchasePrice, type RateParameters } from './parameters'
import { enteredValues, missingParameters, packDefaults, resolveValues, type Overrides, type Values } from './values'

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
  readonly rates: readonly RateParameters[]
  readonly buildClasses: boolean
  readonly purchasePrices: readonly PurchasePrice[]
  readonly priced: Priced | null
  readonly valueOf: (input: Input) => number | null
  readonly sourceOf: (parameter: Parameter) => string | null
  readonly exampleSourceOf: (input: Input) => string | null
  readonly edit: (input: Input, value: number) => void
  readonly resetAll: () => void
}

type ExampleInputs = Readonly<Partial<Record<Input['id'], Assumption<number>>>>

const NO_EXAMPLE_INPUTS: ExampleInputs = {}

function exampleInputsAt(region: Region, plot: Plot): ExampleInputs {
  const landRate = isExampleSite(region, plot.ring) ? region.example?.landRate : null
  return landRate ? { landRate } : NO_EXAMPLE_INPUTS
}

function valuesFor(region: MoneyRegion, site: FinanceSite, overrides: Overrides): Values | null {
  return region.prices ? resolveValues(region.prices, basisOf(site, region.prices), overrides) : enteredValues(overrides, site.use, site.pack)
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
  const plotRegion = useRegion()
  const example = useMemo(() => (solution ? exampleInputsAt(plotRegion, solution.plot) : NO_EXAMPLE_INPUTS), [solution, plotRegion])
  return useMemo(() => {
    if (!site) return null
    const { prices } = region
    const defaults = packDefaults(site.pack)
    const values = valuesFor(region, site, overrides)
    const entered = (input: Input) => overrides[storageKey(input, site.use)]
    const exampleOf = (input: Input) => (entered(input) === undefined ? example[input.id] : undefined)
    const priceOf = (input: Input) => entered(input) ?? exampleOf(input)?.value
    const boughtInputs = neededPrices(site).map((id) => PURCHASE_PRICES[id])
    const missingPrices = boughtInputs.filter((input) => priceOf(input) === undefined)
    const boughtPrices = Object.fromEntries(boughtInputs.map((input) => [input.id, priceOf(input)]))
    return {
      region,
      use: site.use,
      area: prices && placementIn(site, prices),
      hasEdits: Object.keys(overrides).length > 0,
      missing: [...(prices ? [] : missingParameters(overrides, site.use, site.pack)), ...missingPrices],
      rates: ratesFor(site.pack),
      buildClasses: site.pack.buildingClasses !== undefined,
      purchasePrices: offeredPrices(site).map((id) => PURCHASE_PRICES[id]),
      priced: pricedBy(region, site, values, missingPrices.length === 0 ? boughtPrices : null),
      valueOf: (input) => priceOf(input) ?? (values && input.id in values ? values[input.id as Parameter['id']] : null) ?? defaults[input.id as Parameter['id']]?.value ?? null,
      sourceOf: (parameter) => (prices ? parameter.assumed(prices, basisOf(site, prices)).source : (defaults[parameter.id]?.source ?? null)),
      exampleSourceOf: (input) => exampleOf(input)?.source ?? null,
      edit: (input, value) => setOverride(storageKey(input, site.use), value),
      resetAll: clearAll,
    }
  }, [site, region, example, overrides, setOverride, clearAll])
}
