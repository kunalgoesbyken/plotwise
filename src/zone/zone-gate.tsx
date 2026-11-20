'use client'

import { createContext, use, useMemo, type ReactNode } from 'react'
import type { LngLat } from '@/geo/projection'
import type { ZoneCheck } from './cross-check'
import type { ZoneVerdict } from './verdict'
import { useZone } from './use-zone'

export type ZoneGate = {
  readonly zone: string | null
  readonly check: ZoneCheck | null
  readonly confirmed: boolean
  readonly cleared: boolean
  readonly confirmable: boolean
  readonly confirm: () => void
}

const ZoneGateContext = createContext<ZoneGate | null>(null)

const isRefused = (verdict: ZoneVerdict | null) => verdict?.status === 'outside' || verdict?.status === 'straddles'

type ZoneGateProps = {
  readonly zone: string | null
  readonly ring: readonly LngLat[] | null
  readonly confirmed: boolean
  readonly onConfirm: () => void
  readonly children: ReactNode
}

export function ZoneGateProvider({ zone, ring, confirmed, onConfirm, children }: ZoneGateProps) {
  const check = useZone(zone ? ring : null)
  const gate = useMemo(() => {
    const verdict = check?.verdict ?? null
    return {
      zone,
      check,
      confirmed,
      cleared: zone === null || verdict?.status === 'inside' || (confirmed && !isRefused(verdict)),
      confirmable: zone !== null && !confirmed && verdict?.status === 'unknown',
      confirm: onConfirm,
    }
  }, [zone, check, confirmed, onConfirm])
  return <ZoneGateContext value={gate}>{children}</ZoneGateContext>
}

export function useZoneGate(): ZoneGate {
  const gate = use(ZoneGateContext)
  if (!gate) throw new Error('useZoneGate must be used inside ZoneGateProvider')
  return gate
}
