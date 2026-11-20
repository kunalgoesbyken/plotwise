'use client'

import { createContext, use, useMemo, type ReactNode } from 'react'
import type { LngLat } from '@/geo/projection'
import type { ZoneVerdict } from './verdict'
import { useZone } from './use-zone'

export type ZoneGate = {
  readonly verdict: ZoneVerdict | null
  readonly cleared: boolean
  readonly confirmable: boolean
  readonly confirm: () => void
}

const ZoneGateContext = createContext<ZoneGate | null>(null)

const isRefused = (verdict: ZoneVerdict | null) => verdict?.status === 'outside' || verdict?.status === 'straddles'

type ZoneGateProps = {
  readonly ring: readonly LngLat[] | null
  readonly confirmed: boolean
  readonly onConfirm: () => void
  readonly children: ReactNode
}

export function ZoneGateProvider({ ring, confirmed, onConfirm, children }: ZoneGateProps) {
  const verdict = useZone(ring)
  const gate = useMemo(
    () => ({
      verdict,
      cleared: verdict?.status === 'inside' || (confirmed && !isRefused(verdict)),
      confirmable: !confirmed && !isRefused(verdict) && verdict?.status !== 'inside',
      confirm: onConfirm,
    }),
    [verdict, confirmed, onConfirm],
  )
  return <ZoneGateContext value={gate}>{children}</ZoneGateContext>
}

export function useZoneGate(): ZoneGate {
  const gate = use(ZoneGateContext)
  if (!gate) throw new Error('useZoneGate must be used inside ZoneGateProvider')
  return gate
}
