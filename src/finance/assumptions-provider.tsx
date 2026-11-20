'use client'

import { createContext, use, useMemo, type ReactNode } from 'react'
import { useHashState } from '@/editor/url-hash'
import { REGION } from '@/region/regions'
import { MONEY_REGIONS, type MoneyRegion } from '@/solve'
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

export function AssumptionsProvider({ children }: { readonly children: ReactNode }) {
  const [overrides, setOverrides] = useHashState('assume', OVERRIDES_IN_URL)
  const view = useMemo<AssumptionsView>(
    () => ({
      region: MONEY_REGIONS[REGION.id],
      overrides,
      setOverride: (key, value) => setOverrides((current) => ({ ...current, [key]: value })),
      clearAll: () => setOverrides({}),
    }),
    [overrides, setOverrides],
  )
  return <AssumptionsContext value={view}>{children}</AssumptionsContext>
}

export function useAssumptions(): AssumptionsView {
  const view = use(AssumptionsContext)
  if (!view) throw new Error('useAssumptions must be used inside AssumptionsProvider')
  return view
}
