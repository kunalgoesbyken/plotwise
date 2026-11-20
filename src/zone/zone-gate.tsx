'use client'

import { createContext, use, useMemo, type ReactNode } from 'react'
import type { LngLat } from '@/geo/projection'
import type { Region } from '@/region/regions'
import type { ZoneCheck } from './cross-check'
import { hasZoneSource } from './sources'
import type { ZoneVerdict } from './verdict'
import { useZone } from './use-zone'

export type ZoneGate = {
  readonly zone: string | null
  readonly check: ZoneCheck | null
  readonly confirmed: boolean
  readonly cleared: boolean
  readonly pending: boolean
  readonly confirmable: boolean
  readonly confirm: () => void
}

const ZoneGateContext = createContext<ZoneGate | null>(null)

const isRefused = (verdict: ZoneVerdict | null) => verdict?.status === 'outside' || verdict?.status === 'straddles'

type ZoneGateProps = {
  readonly region: Region
  readonly ring: readonly LngLat[] | null
  readonly confirmed: boolean
  readonly onConfirm: () => void
  readonly children: ReactNode
}

export function ZoneGateProvider({ region, ring, confirmed, onConfirm, children }: ZoneGateProps) {
  const zoneRegion = hasZoneSource(region.id) ? region.id : null
  const zone = zoneRegion && (region.zone?.name ?? null)
  const check = useZone(zoneRegion, zone ? ring : null)
  const gate = useMemo(() => {
    const verdict = check?.verdict ?? null
    const cleared = zone === null || verdict?.status === 'inside' || (confirmed && !isRefused(verdict))
    return {
      zone,
      check,
      confirmed,
      cleared,
      pending: !cleared && check === null,
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
