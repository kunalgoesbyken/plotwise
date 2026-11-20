import type { LngLat } from '@/geo/projection'
import { ZONE_SLIVER_SHARE } from './assumptions'
import type { ZoneShare } from './shares'
import { ZONE_SOURCES, type ZoneNaming, type ZoneRegionId, type ZoneSource } from './sources'
import type { UnknownReason, ZonePart, ZoneVerdict } from './verdict'

const ZONE_REGION_IDS = Object.keys(ZONE_SOURCES) as ZoneRegionId[]

export function zoneRegionFor(ring: readonly LngLat[]): ZoneRegionId | undefined {
  const lng = ring.reduce((sum, vertex) => sum + vertex[0], 0) / ring.length
  const lat = ring.reduce((sum, vertex) => sum + vertex[1], 0) / ring.length
  return ZONE_REGION_IDS.find((id) => {
    const [west, south, east, north] = ZONE_SOURCES[id].coverage
    return lng >= west && lng <= east && lat >= south && lat <= north
  })
}

export function unknownVerdict(source: ZoneSource | undefined, reason: UnknownReason): ZoneVerdict {
  return { status: 'unknown', reason, plan: source?.plan ?? null }
}

function nameOf(naming: ZoneNaming, code: string): string | undefined {
  return naming.zones.find((zone) => zone.sourceCode === code)?.name
}

function coveredName(naming: ZoneNaming): string {
  const covered = naming.zones.find((zone) => zone.packCode === naming.coveredCode)
  if (!covered) throw new Error(`Zone source lists no zone for the covered code ${naming.coveredCode}`)
  return covered.name
}

function namedParts(naming: ZoneNaming, shares: readonly ZoneShare[]): (ZonePart & { readonly code: string })[] | null {
  const parts = shares.flatMap(({ code, share }) => {
    const zone = nameOf(naming, code)
    return zone === undefined ? [] : [{ code, zone, share }]
  })
  return parts.length === shares.length ? parts : null
}

export function classifyShares(source: ZoneSource, shares: readonly ZoneShare[]): ZoneVerdict {
  const sliver = ZONE_SLIVER_SHARE.value
  const significant = shares.filter(({ share }) => share >= sliver).sort((a, b) => b.share - a.share)
  if (significant.reduce((sum, { share }) => sum + share, 0) < 1 - sliver) return unknownVerdict(source, 'no-zone')
  const { naming } = source
  const named = namedParts(naming, significant)
  if (!named) return unknownVerdict(source, 'unrecognised')
  const parts = named.map(({ zone, share }) => ({ zone, share }))
  const covered = coveredName(naming)
  if (parts.length > 1) return { status: 'straddles', parts, covered }
  const [{ code, zone }] = named
  const inside = naming.zones.some((entry) => entry.sourceCode === code && entry.packCode === naming.coveredCode)
  return inside ? { status: 'inside', zone } : { status: 'outside', zone, covered }
}
