import type { LngLat } from '@/geo/projection'
import { ZONE_RING_DECIMALS } from './assumptions'
import type { Link } from './sources'

export type UnknownReason = 'no-region' | 'too-large' | 'no-zone' | 'unrecognised' | 'unreachable'

export type ZonePart = { readonly zone: string; readonly share: number }

export type ZoneVerdict =
  | { readonly status: 'inside'; readonly zone: string }
  | { readonly status: 'outside'; readonly zone: string; readonly covered: string }
  | { readonly status: 'straddles'; readonly parts: readonly ZonePart[]; readonly covered: string }
  | { readonly status: 'unknown'; readonly reason: UnknownReason; readonly plan: Link | null }

export function ringKey(ring: readonly LngLat[]): string {
  const decimals = ZONE_RING_DECIMALS.value
  return ring.map((vertex) => vertex.map((value) => value.toFixed(decimals)).join(',')).join(';')
}
