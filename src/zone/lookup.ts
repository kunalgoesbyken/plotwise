import { localFrame, type LngLat } from '@/geo/projection'
import { shrink } from '@/geometry'
import { fetchZoneCodes, type FetchZoneCodesOptions } from './arcgis'
import { ZONE_EDGE_TOLERANCE_M } from './assumptions'
import { classifyZones, sourceFor, unknownVerdict } from './classify'
import type { ZoneVerdict } from './schema'

function innerRings(ring: readonly LngLat[]): LngLat[][] {
  const frame = localFrame(ring[0])
  const inner = shrink([{ outer: ring.map(frame.toLocal), holes: [] }], ZONE_EDGE_TOLERANCE_M.value)
  return inner.length === 0 ? [[...ring]] : inner.map((polygon) => polygon.outer.map(frame.toLngLat))
}

export async function lookupZone(ring: readonly LngLat[], options?: FetchZoneCodesOptions): Promise<ZoneVerdict> {
  const source = sourceFor(ring)
  if (!source) return unknownVerdict(undefined, 'no-region')
  return classifyZones(source, await fetchZoneCodes(source, innerRings(ring), options))
}
