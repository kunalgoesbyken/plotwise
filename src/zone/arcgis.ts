import { z } from 'zod'
import type { LngLat } from '@/geo/projection'
import { USER_AGENT } from '@/site/user-agent'
import { ZONE_TIMEOUT_MS } from './assumptions'
import type { ZoneSource } from './sources'

const WGS84 = 4326

export class ZoneServiceUnavailableError extends Error {}

const ArcGisErrorSchema = z.object({ error: z.object({ message: z.string() }) })

function featuresSchema(zoneField: string) {
  return z.object({ features: z.array(z.object({ attributes: z.record(z.string(), z.unknown()) })) }).transform(({ features }) =>
    features.flatMap(({ attributes }) => {
      const code = attributes[zoneField]
      return typeof code === 'string' ? [code] : []
    }),
  )
}

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

export function zoneQueryUrl({ layerUrl, zoneField }: ZoneSource, rings: readonly (readonly LngLat[])[]): string {
  const params = new URLSearchParams({
    f: 'json',
    where: '1=1',
    geometryType: 'esriGeometryPolygon',
    geometry: JSON.stringify({ rings: rings.map(closedClockwise), spatialReference: { wkid: WGS84 } }),
    inSR: String(WGS84),
    spatialRel: 'esriSpatialRelIntersects',
    outFields: zoneField,
    returnDistinctValues: 'true',
    returnGeometry: 'false',
  })
  return `${layerUrl}/query?${params}`
}

export function parseZoneCodes(source: ZoneSource, body: unknown): string[] {
  const failure = ArcGisErrorSchema.safeParse(body)
  if (failure.success) throw new Error(failure.data.error.message)
  const parsed = featuresSchema(source.zoneField).safeParse(body)
  if (!parsed.success) throw new Error('unexpected response shape')
  return [...new Set(parsed.data)]
}

export type FetchZoneCodesOptions = { timeoutMs?: number; fetchImpl?: typeof fetch }

export async function fetchZoneCodes(
  source: ZoneSource,
  rings: readonly (readonly LngLat[])[],
  { timeoutMs = ZONE_TIMEOUT_MS.value, fetchImpl = fetch }: FetchZoneCodesOptions = {},
): Promise<string[]> {
  try {
    const response = await fetchImpl(zoneQueryUrl(source, rings), {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return parseZoneCodes(source, await response.json())
  } catch (error) {
    throw new ZoneServiceUnavailableError(`Zone service is unavailable: ${error instanceof Error ? error.message : String(error)}`)
  }
}
