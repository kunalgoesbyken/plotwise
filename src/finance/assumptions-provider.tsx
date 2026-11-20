'use client'

import { createContext, use, useMemo, useState, type ReactNode } from 'react'
import { MONEY_REGIONS, type MoneyRegion, type RegionId } from '@/solve'
import type { Overrides } from './values'

export const DEFAULT_REGION: RegionId = 'bkk'

export type AssumptionsView = {
  readonly region: MoneyRegion
  readonly overrides: Overrides
  readonly setOverride: (key: string, value: number) => void
  readonly clearAll: () => void
}

const AssumptionsContext = createContext<AssumptionsView | null>(null)

type ProviderProps = { readonly region?: RegionId; readonly initial?: Overrides; readonly children: ReactNode }

export function AssumptionsProvider({ region = DEFAULT_REGION, initial = {}, children }: ProviderProps) {
  const [overrides, setOverrides] = useState<Overrides>(initial)
  const view = useMemo<AssumptionsView>(
    () => ({
      region: MONEY_REGIONS[region],
      overrides,
      setOverride: (key, value) => setOverrides((current) => ({ ...current, [key]: value })),
      clearAll: () => setOverrides({}),
    }),
    [region, overrides],
  )
  return <AssumptionsContext value={view}>{children}</AssumptionsContext>
}

export function useAssumptions(): AssumptionsView {
  const view = use(AssumptionsContext)
  if (!view) throw new Error('useAssumptions must be used inside AssumptionsProvider')
  return view
}
