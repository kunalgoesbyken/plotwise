import type { LngLat } from '@/geo/projection'
import { fetchZoneCodes, type FetchZoneCodesOptions } from './arcgis'
import { classifyZones, sourceFor, unknownVerdict } from './classify'
import type { ZoneVerdict } from './schema'

export async function lookupZone(ring: readonly LngLat[], options?: FetchZoneCodesOptions): Promise<ZoneVerdict> {
  const source = sourceFor(ring)
  if (!source) return unknownVerdict(undefined, 'no-region')
  return classifyZones(source, await fetchZoneCodes(source, ring, options))
}
