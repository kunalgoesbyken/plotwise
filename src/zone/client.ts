import type { LngLat } from '@/geo/projection'
import { encodeRing, ZoneVerdictSchema, type ZoneVerdict } from './schema'

export const ZONE_ENDPOINT = '/api/zone'

export type FetchZoneOptions = { signal?: AbortSignal; fetchImpl?: typeof fetch }

export async function fetchZone(ring: readonly LngLat[], { signal, fetchImpl = fetch }: FetchZoneOptions = {}): Promise<ZoneVerdict> {
  const response = await fetchImpl(`${ZONE_ENDPOINT}?${new URLSearchParams({ ring: encodeRing(ring) })}`, { signal })
  if (!response.ok) throw new Error(`Zone check failed with HTTP ${response.status}`)
  return ZoneVerdictSchema.parse(await response.json())
}
