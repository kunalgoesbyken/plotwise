'use client'

import { createContext, use, useMemo, type ReactNode } from 'react'
import { useRegion } from '@/editor/plot-store'
import { useHashState } from '@/editor/url-hash'
import { DEFAULT_REGION } from '@/region/regions'
import { MONEY_REGIONS, type MoneyRegion, type RegionId } from '@/solve'
import { decodeAskingPrice, decodeAssumptions, encodeAskingPrice, encodeAssumptions, type AssumptionsState, type ExampleChoice } from './url'
import type { Overrides } from './values'

export type AssumptionsView = {
  readonly region: MoneyRegion
  readonly overrides: Overrides
  readonly examples: ExampleChoice
  readonly setOverride: (key: string, value: number) => void
  readonly setExamples: (examples: ExampleChoice) => void
  readonly clearAll: (examples: ExampleChoice) => void
  readonly askingPrice: number | null
  readonly setAskingPrice: (price: number | null) => void
}

const AssumptionsContext = createContext<AssumptionsView | null>(null)

const assumptionsInUrl = (region: MoneyRegion) => ({
  decode: (encoded: string | null) => decodeAssumptions(encoded, region),
  encode: ({ overrides, examples }: AssumptionsState) => encodeAssumptions(overrides, examples),
})

const ASKING_PRICE_IN_URL = { decode: decodeAskingPrice, encode: encodeAskingPrice }

const regionParam = (name: string, region: RegionId) => (region === DEFAULT_REGION.id ? name : `${name}-${region}`)

export function AssumptionsProvider({ children }: { readonly children: ReactNode }) {
  const { id } = useRegion()
  const assumptionsCodec = useMemo(() => assumptionsInUrl(MONEY_REGIONS[id]), [id])
  const [assumptions, setAssumptions] = useHashState(regionParam('assume', id), assumptionsCodec)
  const [askingPrice, setAskingPrice] = useHashState(regionParam('ask', id), ASKING_PRICE_IN_URL)
  const view = useMemo<AssumptionsView>(
    () => ({
      region: MONEY_REGIONS[id],
      overrides: assumptions.overrides,
      examples: assumptions.examples,
      setOverride: (key, value) => setAssumptions((current) => ({ ...current, overrides: { ...current.overrides, [key]: value } })),
      setExamples: (examples) => setAssumptions((current) => ({ ...current, examples })),
      clearAll: (examples) => setAssumptions({ overrides: {}, examples }),
      askingPrice,
      setAskingPrice,
    }),
    [id, assumptions, setAssumptions, askingPrice, setAskingPrice],
  )
  return <AssumptionsContext value={view}>{children}</AssumptionsContext>
}

export function useAssumptions(): AssumptionsView {
  const view = use(AssumptionsContext)
  if (!view) throw new Error('useAssumptions must be used inside AssumptionsProvider')
  return view
}
