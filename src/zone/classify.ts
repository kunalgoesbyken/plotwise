import type { LngLat } from '@/geo/projection'
import type { UnknownReason, ZoneVerdict } from './schema'
import { ZONE_SOURCES, type ZoneSource } from './sources'

export function sourceFor(ring: readonly LngLat[]): ZoneSource | undefined {
  const lng = ring.reduce((sum, vertex) => sum + vertex[0], 0) / ring.length
  const lat = ring.reduce((sum, vertex) => sum + vertex[1], 0) / ring.length
  return Object.values(ZONE_SOURCES).find(
    ({ coverage: [west, south, east, north] }) => lng >= west && lng <= east && lat >= south && lat <= north,
  )
}

export function unknownVerdict(source: ZoneSource | undefined, reason: UnknownReason): ZoneVerdict {
  return { status: 'unknown', reason, plan: source?.plan ?? null }
}

function coveredName(source: ZoneSource): string {
  const covered = source.zones.find((zone) => zone.packCode === source.coveredCode)
  if (!covered) throw new Error(`Zone source lists no zone for the covered code ${source.coveredCode}`)
  return covered.name
}

export function classifyZones(source: ZoneSource, codes: readonly string[]): ZoneVerdict {
  if (codes.length === 0) return unknownVerdict(source, 'no-zone')
  const entries = codes.flatMap((code) => source.zones.find((zone) => zone.sourceCode === code) ?? [])
  if (entries.length < codes.length) return unknownVerdict(source, 'unrecognised')
  const covered = coveredName(source)
  if (entries.length > 1) return { status: 'mixed', zones: entries.map((entry) => entry.name), covered }
  const [entry] = entries
  return entry.packCode === source.coveredCode
    ? { status: 'inside', zone: entry.name }
    : { status: 'outside', zone: entry.name, covered }
}
