import { z } from 'zod'
import type { LngLat } from '@/geo/projection'
import { ZONE_SNAPSHOT_ATTEMPTS, ZONE_SNAPSHOT_TIMEOUT_MS } from './assumptions'
import { classifyShares, zoneRegionFor } from './classify'
import type { SnapshotVerdict } from './cross-check'
import { isPlotSized } from './lookup'
import { zoneShares } from './shares'
import { ZONE_SOURCES, type ZoneRegionId, type ZoneSource } from './sources'
import type { ZoneVerdict } from './verdict'

const VertexSchema = z.tuple([z.number(), z.number()]).readonly()

export const ZoneSnapshotSchema = z
  .object({
    layer: z.url(),
    url: z.url(),
    where: z.string(),
    fetchedAt: z.iso.datetime(),
    via: z.string().min(1),
    featureCount: z.number().int(),
    features: z.array(z.object({ code: z.string(), rings: z.array(z.array(VertexSchema)) })),
  })
  .refine(({ featureCount, features }) => featureCount === features.length, 'featureCount does not match the features')

export type ZoneSnapshot = z.infer<typeof ZoneSnapshotSchema>

export function snapshotVerdict(source: ZoneSource, { features }: ZoneSnapshot, ring: readonly LngLat[]): ZoneVerdict {
  const shares = zoneShares(ring, features)
  const held = shares.reduce((sum, { share }) => sum + share, 0)
  return classifyShares(source, [...shares, { code: null, share: 1 - held }])
}

export function snapshotZone(ring: readonly LngLat[], region: ZoneRegionId, snapshot: ZoneSnapshot): SnapshotVerdict | null {
  if (zoneRegionFor(ring) !== region || !isPlotSized(ring)) return null
  const source = ZONE_SOURCES[region]
  return { verdict: snapshotVerdict(source, snapshot, ring), asOf: snapshot.fetchedAt, source }
}

export async function fetchZoneSnapshot(source: ZoneSource, fetchImpl: typeof fetch = fetch, timeoutMs = ZONE_SNAPSHOT_TIMEOUT_MS.value): Promise<ZoneSnapshot> {
  const request = new AbortController()
  const timer = setTimeout(() => request.abort(), timeoutMs)
  try {
    const response = await fetchImpl(source.snapshot, { signal: request.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return ZoneSnapshotSchema.parse(await response.json())
  } finally {
    clearTimeout(timer)
  }
}

type LoadSnapshot = (source: ZoneSource) => Promise<ZoneSnapshot>

async function withRetries(load: LoadSnapshot, source: ZoneSource, attempts: number): Promise<ZoneSnapshot> {
  try {
    return await load(source)
  } catch (error) {
    if (attempts <= 1) throw error
    return withRetries(load, source, attempts - 1)
  }
}

export function createSnapshotLoader(load: LoadSnapshot = fetchZoneSnapshot): (region: ZoneRegionId) => Promise<ZoneSnapshot> {
  const loads = new Map<ZoneRegionId, Promise<ZoneSnapshot>>()
  return (region) => {
    const known = loads.get(region)
    if (known) return known
    const loading = withRetries(load, ZONE_SOURCES[region], ZONE_SNAPSHOT_ATTEMPTS.value)
    loads.set(region, loading)
    loading.catch(() => loads.delete(region))
    return loading
  }
}

export const loadZoneSnapshot = createSnapshotLoader()
