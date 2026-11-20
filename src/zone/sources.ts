import { REGIONS } from '@/region/regions'
import { loadPack, type PackId } from '@/rules'
import type { Bbox } from '@/site/bbox'
import type { RegionId } from '@/solve'

export type ZoneEntry = {
  readonly sourceCode: string
  readonly packCode: string
  readonly name: string
}

export type ZoneSource = {
  readonly plan: { readonly name: string; readonly url: string }
  readonly layerUrl: string
  readonly zoneField: string
  readonly coverage: Bbox
  readonly licence: string
  readonly attribution: string
  readonly coveredCode: string
  readonly zones: readonly ZoneEntry[]
}

function zoneCode(packId: PackId): string {
  const { zone } = loadPack(packId)
  if (!zone) throw new Error(`pack ${packId} names no zone`)
  return zone.code
}

export const ZONE_SOURCES: Readonly<Record<RegionId, ZoneSource>> = {
  bkk: {
    plan: REGIONS.bkk.cityPlan,
    layerUrl: 'https://cityplangis.bangkok.go.th/arcgis/rest/services/LanduseMonitor/comprehensiveplan_2556/MapServer/8',
    zoneField: 'LUP_ZONE',
    coverage: [100.326, 13.485, 100.94, 13.953],
    licence:
      'Public ArcGIS REST layer of the Bangkok Metropolitan Administration (BMA). It publishes no licence text, so Plotwise queries it live, stores no copy and shows only the zone name.',
    attribution: 'Bangkok Comprehensive Plan B.E. 2556 land-use plan, BMA City Planning and Urban Development Department (cityplangis.bangkok.go.th)',
    coveredCode: zoneCode(REGIONS.bkk.packId),
    zones: [
      { sourceCode: 'ก.๑', packCode: 'ก.1', name: 'green-hatched zone 1 (agricultural)' },
      { sourceCode: 'ก.๒', packCode: 'ก.2', name: 'green-hatched zone 2 (agricultural)' },
      { sourceCode: 'ก.๓', packCode: 'ก.3', name: 'green-hatched zone 3 (agricultural)' },
      { sourceCode: 'ก.๔', packCode: 'ก.4', name: 'green zone 4 (agricultural)' },
      { sourceCode: 'ก.๕', packCode: 'ก.5', name: 'green zone 5 (agricultural)' },
      { sourceCode: 'พ.๑', packCode: 'พ.1', name: 'red zone 1 (commercial)' },
      { sourceCode: 'พ.๒', packCode: 'พ.2', name: 'red zone 2 (commercial)' },
      { sourceCode: 'พ.๓', packCode: 'พ.3', name: 'red zone 3 (commercial)' },
      { sourceCode: 'พ.๔', packCode: 'พ.4', name: 'red zone 4 (commercial)' },
      { sourceCode: 'พ.๕', packCode: 'พ.5', name: 'red zone 5 (commercial)' },
      { sourceCode: 'ย.๑', packCode: 'ย.1', name: 'yellow zone 1 (low-density residential)' },
      { sourceCode: 'ย.๒', packCode: 'ย.2', name: 'yellow zone 2 (low-density residential)' },
      { sourceCode: 'ย.๓', packCode: 'ย.3', name: 'yellow zone 3 (low-density residential)' },
      { sourceCode: 'ย.๔', packCode: 'ย.4', name: 'yellow zone 4 (low-density residential)' },
      { sourceCode: 'ย.๕', packCode: 'ย.5', name: 'orange zone 5 (medium-density residential)' },
      { sourceCode: 'ย.๖', packCode: 'ย.6', name: 'orange zone 6 (medium-density residential)' },
      { sourceCode: 'ย.๗', packCode: 'ย.7', name: 'orange zone 7 (medium-density residential)' },
      { sourceCode: 'ย.๘', packCode: 'ย.8', name: 'brown zone 8 (very high-density residential)' },
      { sourceCode: 'ย.๙', packCode: 'ย.9', name: 'brown zone 9 (very high-density residential)' },
      { sourceCode: 'ย.๑๐', packCode: 'ย.10', name: 'brown zone 10 (very high-density residential)' },
      { sourceCode: 'ศ.๑', packCode: 'ศ.1', name: 'light-brown zone 1' },
      { sourceCode: 'ศ.๒', packCode: 'ศ.2', name: 'light-brown zone 2' },
      { sourceCode: 'ส.', packCode: 'ส.', name: 'blue zone' },
      { sourceCode: 'อ.๑', packCode: 'อ.1', name: 'purple zone 1 (industrial and warehouse)' },
      { sourceCode: 'อ.๒', packCode: 'อ.2', name: 'purple zone 2 (industrial and warehouse)' },
      { sourceCode: 'อ.๓', packCode: 'อ.3', name: 'pale-orange zone 3 (industrial)' },
    ],
  },
}
