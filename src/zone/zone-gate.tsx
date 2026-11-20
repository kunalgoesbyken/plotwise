'use client'

import { createContext, use, useMemo, type ReactNode } from 'react'
import type { LngLat } from '@/geo/projection'
import type { ZoneVerdict } from './schema'
import { useZone } from './use-zone'

export type ZoneGate = {
  readonly zone: string | null
  readonly verdict: ZoneVerdict | null
  readonly cleared: boolean
  readonly confirmable: boolean
  readonly confirm: () => void
}

const ZoneGateContext = createContext<ZoneGate | null>(null)

const isRefused = (verdict: ZoneVerdict | null) => verdict?.status === 'outside' || verdict?.status === 'mixed'

type ZoneGateProps = {
  readonly zone: string | null
  readonly ring: readonly LngLat[] | null
  readonly confirmed: boolean
  readonly onConfirm: () => void
  readonly children: ReactNode
}

export function ZoneGateProvider({ zone, ring, confirmed, onConfirm, children }: ZoneGateProps) {
  const verdict = useZone(zone ? ring : null)
  const gate = useMemo(
    () => ({
      zone,
      verdict,
      cleared: zone === null || verdict?.status === 'inside' || (confirmed && !isRefused(verdict)),
      confirmable: zone !== null && !confirmed && !isRefused(verdict) && verdict?.status !== 'inside',
      confirm: onConfirm,
    }),
    [zone, verdict, confirmed, onConfirm],
  )
  return <ZoneGateContext value={gate}>{children}</ZoneGateContext>
}

export function useZoneGate(): ZoneGate {
  const gate = use(ZoneGateContext)
  if (!gate) throw new Error('useZoneGate must be used inside ZoneGateProvider')
  return gate
}
