import { REGIONS } from '@/region/regions'
import { loadPack, type PackId } from '@/rules'
import type { Bbox } from '@/site/bbox'
import type { RegionId } from '@/solve'
import { BMA_LAYER_ORIGIN } from './layer-origin'

export type ZoneEntry = {
  readonly sourceCode: string
  readonly packCode: string
  readonly name: string
}

export type ArcGisLayer = {
  readonly name: string
  readonly url: string
  readonly zoneField: string
}

export type ZoneNaming = { readonly zones: readonly ZoneEntry[]; readonly coveredCode: string }

export type Link = { readonly name: string; readonly url: string }

export type ZoneSource = {
  readonly publisher: string
  readonly plan: Link
  readonly layer: ArcGisLayer
  readonly snapshot: string
  readonly licence: { readonly summary: string; readonly url: string }
  readonly coverage: Bbox
  readonly naming: ZoneNaming
}

const BANGKOK_ZONES: readonly ZoneEntry[] = [
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
]

function zoneCode(packId: PackId): string {
  const { zone } = loadPack(packId)
  if (!zone) throw new Error(`pack ${packId} names no zone`)
  return zone.code
}

const BMA_LAYER_URL = `${BMA_LAYER_ORIGIN}/arcgis/rest/services/LanduseMonitor/comprehensiveplan_2556/MapServer/8`

export const ZONE_SOURCES = {
  bkk: {
    publisher: 'Bangkok Metropolitan Administration (BMA), City Planning and Urban Development Department',
    plan: REGIONS.bkk.cityPlan,
    layer: {
      name: 'BMA city-plan layer',
      url: BMA_LAYER_URL,
      zoneField: 'LUP_ZONE',
    },
    snapshot: '/zone/bma-2556-y9.json',
    licence: {
      summary:
        'Plotwise keeps a dated copy of the brown zone 9 polygons of this ArcGIS REST layer, which the BMA publishes without licence text, and checks the live layer against it. The polygons are the BMA rendering of the land-use map annexed to the Ministerial Regulation enforcing the Bangkok Comprehensive Plan B.E. 2556; section 7 of the Copyright Act B.E. 2537 does not treat the constitution and legislation, or regulations, bylaws, notifications and orders of government and local units, as copyright works.',
      url: 'https://www.ipthailand.go.th/images/3534/2565/Copyright/Copyright_Act2_TH.pdf',
    },
    coverage: [100.326, 13.485, 100.94, 13.953],
    naming: { zones: BANGKOK_ZONES, coveredCode: zoneCode(REGIONS.bkk.packId) },
  },
} satisfies Partial<Record<RegionId, ZoneSource>>

export type ZoneRegionId = keyof typeof ZONE_SOURCES
