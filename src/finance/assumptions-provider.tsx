'use client'

import { createContext, use, useMemo, type ReactNode } from 'react'
import { useRegion } from '@/editor/plot-store'
import { useHashState } from '@/editor/url-hash'
import { DEFAULT_REGION } from '@/region/regions'
import { MONEY_REGIONS, type MoneyRegion, type RegionId } from '@/solve'
import { decodeAssumptions, encodeAssumptions } from './url'
import type { Overrides } from './values'

export type AssumptionsView = {
  readonly region: MoneyRegion
  readonly overrides: Overrides
  readonly setOverride: (key: string, value: number) => void
  readonly clearAll: () => void
}

const AssumptionsContext = createContext<AssumptionsView | null>(null)

const OVERRIDES_IN_URL = { decode: decodeAssumptions, encode: encodeAssumptions }

const overridesParam = (region: RegionId) => (region === DEFAULT_REGION.id ? 'assume' : `assume-${region}`)

export function AssumptionsProvider({ children }: { readonly children: ReactNode }) {
  const { id } = useRegion()
  const [overrides, setOverrides] = useHashState(overridesParam(id), OVERRIDES_IN_URL)
  const view = useMemo<AssumptionsView>(
    () => ({
      region: MONEY_REGIONS[id],
      overrides,
      setOverride: (key, value) => setOverrides((current) => ({ ...current, [key]: value })),
      clearAll: () => setOverrides({}),
    }),
    [id, overrides, setOverrides],
  )
  return <AssumptionsContext value={view}>{children}</AssumptionsContext>
}

export function useAssumptions(): AssumptionsView {
  const view = use(AssumptionsContext)
  if (!view) throw new Error('useAssumptions must be used inside AssumptionsProvider')
  return view
}
