import { z } from 'zod'
import type { LngLat } from '@/geo/projection'
import { ZONE_GENERALISATION_DEGREES, ZONE_TIMEOUT_MS } from './assumptions'
import type { ArcGisLayer } from './sources'

const WGS84 = 4326
const COORDINATE_DECIMALS = 6

export class ZoneServiceUnavailableError extends Error {}

export type ZoneFeature = { readonly code: string; readonly rings: readonly (readonly LngLat[])[] }

const ArcGisErrorSchema = z.object({ error: z.object({ message: z.string() }) })

const VertexSchema = z.array(z.number()).min(2).transform(([lng, lat]): LngLat => [lng, lat])

const FeatureSchema = z.object({
  attributes: z.record(z.string(), z.unknown()),
  geometry: z.object({ rings: z.array(z.array(VertexSchema)) }).nullish(),
})

const FeaturesSchema = z.object({ features: z.array(FeatureSchema) })

function isClockwise(ring: readonly LngLat[]): boolean {
  const twiceArea = ring.reduce((sum, [lng, lat], index) => {
    const [nextLng, nextLat] = ring[(index + 1) % ring.length]
    return sum + (nextLng - lng) * (nextLat + lat)
  }, 0)
  return twiceArea > 0
}

function closedClockwise(ring: readonly LngLat[]): LngLat[] {
  const ordered = isClockwise(ring) ? [...ring] : [...ring].reverse()
  return [...ordered, ordered[0]]
}

export function zoneQueryUrl({ url, zoneField }: ArcGisLayer, plot: readonly LngLat[]): string {
  const params = new URLSearchParams({
    f: 'json',
    where: '1=1',
    geometryType: 'esriGeometryPolygon',
    geometry: JSON.stringify({ rings: [closedClockwise(plot)], spatialReference: { wkid: WGS84 } }),
    inSR: String(WGS84),
    outSR: String(WGS84),
    spatialRel: 'esriSpatialRelIntersects',
    outFields: zoneField,
    returnGeometry: 'true',
    maxAllowableOffset: String(ZONE_GENERALISATION_DEGREES.value),
    geometryPrecision: String(COORDINATE_DECIMALS),
  })
  return `${url}/query?${params}`
}

export function parseZoneFeatures({ zoneField }: ArcGisLayer, body: unknown): ZoneFeature[] {
  const failure = ArcGisErrorSchema.safeParse(body)
  if (failure.success) throw new Error(failure.data.error.message)
  const parsed = FeaturesSchema.safeParse(body)
  if (!parsed.success) throw new Error('unexpected response shape')
  return parsed.data.features.flatMap(({ attributes, geometry }) => {
    const code = attributes[zoneField]
    return typeof code === 'string' && geometry ? [{ code, rings: geometry.rings }] : []
  })
}

export type FetchZoneFeaturesOptions = { signal?: AbortSignal; timeoutMs?: number; fetchImpl?: typeof fetch }

export async function fetchZoneFeatures(
  layer: ArcGisLayer,
  plot: readonly LngLat[],
  { signal, timeoutMs = ZONE_TIMEOUT_MS.value, fetchImpl = fetch }: FetchZoneFeaturesOptions = {},
): Promise<ZoneFeature[]> {
  const request = new AbortController()
  const cancel = () => request.abort()
  const timer = setTimeout(cancel, timeoutMs)
  signal?.addEventListener('abort', cancel, { once: true })
  if (signal?.aborted) cancel()
  try {
    const response = await fetchImpl(zoneQueryUrl(layer, plot), { signal: request.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return parseZoneFeatures(layer, await response.json())
  } catch (error) {
    throw new ZoneServiceUnavailableError(`Zone service is unavailable: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', cancel)
  }
}
