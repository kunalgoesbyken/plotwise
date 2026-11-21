'use client'

import { useMemo } from 'react'
import type { Design } from '@/designs'
import { useRegion } from '@/editor/plot-store'
import { useFeasibility } from '@/feasibility/feasibility-provider'
import type { BuildingType, Plot } from '@/plot/plot'
import { isExampleSite, type Region } from '@/region/regions'
import type { MoneyRegion } from '@/solve'
import type { Placement } from './area'
import { useAssumptions } from './assumptions-provider'
import { estimate, financeSite, landUnitsOf, moneySiteOf, needsBasement, neededPrices, offeredPrices, placementIn, type Estimate, type FinanceSite, type PurchasePrices } from './estimate'
import { landCheck, type LandCheck } from './land-check'
import { isParameter, isPurchasePrice, PURCHASE_PRICES, ratesFor, SCALARS, storageKey, type Input, type Parameter, type PurchasePrice, type RateParameters } from './parameters'
import { purchaseWorth, type PurchaseWorth } from './purchase-worth'
import type { ExampleChoice } from './url'
import { BASEMENT_RATES, defaultOf, enteredOrDefault, missingParameters, moneyDefaults, NO_UNUSED_RATES, resolveValues, type DefaultKind, type Values } from './values'

export type Priced = {
  readonly values: Values
  readonly estimateFor: (design: Design) => Estimate
  readonly landCheckOf: (estimate: Estimate) => LandCheck
}

export type ValueLabel = 'estimated' | 'generic' | 'example' | 'split'

export type Finance = {
  readonly region: MoneyRegion
  readonly use: BuildingType
  readonly area: Placement | null
  readonly landUnits: number
  readonly hasEdits: boolean
  readonly examples: 'applied' | 'available' | 'none'
  readonly shellAndCoreOnly: boolean
  readonly missing: readonly Input[]
  readonly rates: readonly RateParameters[]
  readonly buildClasses: boolean
  readonly purchasePrices: readonly PurchasePrice[]
  readonly priced: Priced | null
  readonly worthOfBuying: () => PurchaseWorth | null
  readonly valueOf: (input: Input) => number | null
  readonly sourceOf: (parameter: Parameter) => string | null
  readonly labelOf: (parameter: Parameter) => ValueLabel
  readonly exampleSourceOf: (input: Input) => string | null
  readonly edit: (input: Input, value: number) => void
  readonly fillExamples: () => void
  readonly resetAll: () => void
}

const LABELS: Readonly<Record<DefaultKind, ValueLabel>> = { rule: 'estimated', local: 'estimated', example: 'example', split: 'split', generic: 'generic' }

const NO_DESIGNS: readonly Design[] = []

const isApplied = (choice: ExampleChoice, region: Region, plot: Plot) => choice ?? isExampleSite(region, plot.ring)

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
  const designs = result?.status === 'ready' ? result.designs : NO_DESIGNS
  const { region, overrides, examples, setOverride, setExamples, clearAll } = useAssumptions()
  const solution = result?.status === 'ready' ? result.solution : null
  const site = useMemo(() => solution && financeSite(solution, region), [solution, region])
  const plotRegion = useRegion()
  const exampleMoney = plotRegion.example?.money ?? null
  const applied = solution !== null && exampleMoney !== null && isApplied(examples, plotRegion, solution.plot)
  return useMemo(() => {
    if (!site) return null
    const example = applied ? exampleMoney : null
    const defaults = moneyDefaults(region, moneySiteOf(site, region), example)
    const levels = enteredOrDefault(SCALARS.parkingLevels, overrides, defaults)
    const unused = levels !== undefined && !needsBasement(designs.map(({ metrics }) => metrics), levels) ? BASEMENT_RATES : NO_UNUSED_RATES
    const values = resolveValues(overrides, defaults, unused)
    const entered = (input: Input) => overrides[storageKey(input, site.use)]
    const exampleOf = (input: Input) => (entered(input) === undefined && example && isPurchasePrice(input) ? example[input.id] : null)
    const priceOf = (input: Input) => entered(input) ?? exampleOf(input)?.value
    const boughtInputs = neededPrices(site).map((id) => PURCHASE_PRICES[id])
    const missingPrices = boughtInputs.filter((input) => priceOf(input) === undefined)
    const boughtPrices = Object.fromEntries(boughtInputs.map((input) => [input.id, priceOf(input)]))
    const labelOf = (parameter: Parameter): ValueLabel => {
      const kind = defaultOf(parameter, defaults)?.kind
      return kind && entered(parameter) === undefined ? LABELS[kind] : 'estimated'
    }
    const defaultValue = (input: Input) => (isParameter(input) ? defaultOf(input, defaults)?.value : undefined)
    return {
      region,
      use: site.use,
      area: region.local && placementIn(site, region.local),
      landUnits: landUnitsOf(site),
      hasEdits: Object.keys(overrides).length > 0 || applied,
      examples: applied ? 'applied' : exampleMoney ? 'available' : 'none',
      shellAndCoreOnly: example?.buildRateScope === 'shellAndCore' && ratesFor(site.pack).some(({ low }) => labelOf(low) === 'split'),
      missing: [...missingParameters(overrides, defaults, unused), ...missingPrices],
      rates: ratesFor(site.pack),
      buildClasses: site.pack.buildingClasses !== undefined,
      purchasePrices: offeredPrices(site).map((id) => PURCHASE_PRICES[id]),
      priced: pricedBy(region, site, values, missingPrices.length === 0 ? boughtPrices : null),
      worthOfBuying: () => {
        if (!solution || !values) return null
        return purchaseWorth(solution, { region, values, priceOf: (input) => priceOf(input) ?? null, basementUnrated: unused === BASEMENT_RATES })
      },
      valueOf: (input) => priceOf(input) ?? defaultValue(input) ?? null,
      sourceOf: (parameter) => defaultOf(parameter, defaults)?.source ?? null,
      labelOf,
      exampleSourceOf: (input) => exampleOf(input)?.source ?? null,
      edit: (input, value) => setOverride(storageKey(input, site.use), value),
      fillExamples: () => setExamples(true),
      resetAll: () => clearAll(exampleMoney ? false : null),
    }
  }, [site, solution, designs, region, applied, exampleMoney, overrides, setOverride, setExamples, clearAll])
}
