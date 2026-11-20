import type { LngLat } from '@/geo/projection'
import { MAX_BBOX_SIDE_M } from '@/site/assumptions'
import { bboxSideLengthsM } from '@/site/bbox'
import { fetchZoneFeatures, ZoneServiceUnavailableError, type FetchZoneFeaturesOptions } from './arcgis'
import { ZONE_ANSWER_MEMORY_MS, ZONE_UNREACHABLE_MEMORY_MS } from './assumptions'
import { classifyShares, unknownVerdict, zoneRegionFor } from './classify'
import type { SnapshotVerdict } from './cross-check'
import { zoneShares } from './shares'
import { snapshotVerdict, type ZoneSnapshot } from './snapshot'
import { ZONE_SOURCES, type ZoneRegionId } from './sources'
import { ringKey, type ZoneVerdict } from './verdict'

function isPlotSized(ring: readonly LngLat[]): boolean {
  const lngs = ring.map(([lng]) => lng)
  const lats = ring.map(([, lat]) => lat)
  const { widthM, heightM } = bboxSideLengthsM([Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)])
  return Math.max(widthM, heightM) <= MAX_BBOX_SIDE_M.value
}

export function snapshotZone(ring: readonly LngLat[], region: ZoneRegionId, snapshot: ZoneSnapshot): SnapshotVerdict | null {
  if (!isPlotSized(ring)) return null
  const source = ZONE_SOURCES[region]
  return { verdict: snapshotVerdict(source, snapshot, ring), asOf: snapshot.fetchedAt, source }
}

export type ZoneLookup = (ring: readonly LngLat[], signal?: AbortSignal) => Promise<ZoneVerdict>

type Remembered = { readonly verdict: ZoneVerdict; readonly until: number }

export function createZoneLookup({ now = Date.now, ...fetchOptions }: Omit<FetchZoneFeaturesOptions, 'signal'> & { now?: () => number } = {}): ZoneLookup {
  const answers = new Map<string, Remembered>()
  const unreachableUntil = new Map<ZoneRegionId, number>()

  return async (ring, signal) => {
    const region = zoneRegionFor(ring)
    if (!region) return unknownVerdict(undefined, 'no-region')
    const source = ZONE_SOURCES[region]
    if (!isPlotSized(ring)) return unknownVerdict(source, 'too-large')
    const key = `${region}:${ringKey(ring)}`
    const answer = answers.get(key)
    if (answer && answer.until > now()) return answer.verdict
    if ((unreachableUntil.get(region) ?? 0) > now()) return unknownVerdict(source, 'unreachable')
    try {
      const features = await fetchZoneFeatures(source.layer, ring, { ...fetchOptions, signal })
      const verdict = classifyShares(source, zoneShares(ring, features))
      answers.set(key, { verdict, until: now() + ZONE_ANSWER_MEMORY_MS.value })
      return verdict
    } catch (error) {
      if (!(error instanceof ZoneServiceUnavailableError) || signal?.aborted) throw error
      unreachableUntil.set(region, now() + ZONE_UNREACHABLE_MEMORY_MS.value)
      return unknownVerdict(source, 'unreachable')
    }
  }
}

export const lookupZone = createZoneLookup()
