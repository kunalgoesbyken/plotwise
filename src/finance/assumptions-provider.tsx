'use client'

import { createContext, use, useMemo, type ReactNode } from 'react'
import { useRegion } from '@/editor/plot-store'
import { useHashState } from '@/editor/url-hash'
import { DEFAULT_REGION } from '@/region/regions'
import { MONEY_REGIONS, type MoneyRegion, type RegionId } from '@/solve'
import { decodeAskingPrice, decodeAssumptions, encodeAskingPrice, encodeAssumptions } from './url'
import type { Overrides } from './values'

export type AssumptionsView = {
  readonly region: MoneyRegion
  readonly overrides: Overrides
  readonly setOverride: (key: string, value: number) => void
  readonly clearAll: () => void
  readonly askingPrice: number | null
  readonly setAskingPrice: (price: number | null) => void
}

const AssumptionsContext = createContext<AssumptionsView | null>(null)

const overridesInUrl = (region: MoneyRegion) => ({ decode: (encoded: string | null) => decodeAssumptions(encoded, region), encode: encodeAssumptions })

const ASKING_PRICE_IN_URL = { decode: decodeAskingPrice, encode: encodeAskingPrice }

const regionParam = (name: string, region: RegionId) => (region === DEFAULT_REGION.id ? name : `${name}-${region}`)

export function AssumptionsProvider({ children }: { readonly children: ReactNode }) {
  const { id } = useRegion()
  const overridesCodec = useMemo(() => overridesInUrl(MONEY_REGIONS[id]), [id])
  const [overrides, setOverrides] = useHashState(regionParam('assume', id), overridesCodec)
  const [askingPrice, setAskingPrice] = useHashState(regionParam('ask', id), ASKING_PRICE_IN_URL)
  const view = useMemo<AssumptionsView>(
    () => ({
      region: MONEY_REGIONS[id],
      overrides,
      setOverride: (key, value) => setOverrides((current) => ({ ...current, [key]: value })),
      clearAll: () => setOverrides({}),
      askingPrice,
      setAskingPrice,
    }),
    [id, overrides, setOverrides, askingPrice, setAskingPrice],
  )
  return <AssumptionsContext value={view}>{children}</AssumptionsContext>
}

export function useAssumptions(): AssumptionsView {
  const view = use(AssumptionsContext)
  if (!view) throw new Error('useAssumptions must be used inside AssumptionsProvider')
  return view
}
