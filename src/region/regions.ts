import { z } from 'zod'
import type { LngLat } from '@/geo/projection'
import type { PackId } from '@/rules'
import type { Assumption } from '@/site/assumptions'
import type { RegionId } from '@/solve'

type Bounds = readonly [minLng: number, minLat: number, maxLng: number, maxLat: number]

export type Region = {
  readonly id: RegionId
  readonly city: string
  readonly country: string
  readonly packId: PackId
  readonly zone: { readonly name: string; readonly scope: string }
  readonly authority: string
  readonly cityPlanUrl: string
  readonly bounds: Assumption<Bounds>
  readonly searchBias: Assumption<LngLat>
  readonly transit: {
    readonly platformModes: Assumption<readonly string[]>
    readonly stationNodeTypes: Assumption<readonly string[]>
  }
}

const REGIONS = {
  bkk: {
    id: 'bkk',
    city: 'Bangkok',
    country: 'Thailand',
    packId: 'bkk-y9',
    zone: {
      name: 'Brown zone · very high-density residential',
      scope: 'Plotwise covers only this zone of the Bangkok city plan.',
    },
    authority: 'the BMA',
    cityPlanUrl: 'https://webportal.bangkok.go.th/cpud',
    bounds: {
      value: [97.3, 5.6, 105.7, 20.5],
      source: 'approximate extent of Thailand (minLng, minLat, maxLng, maxLat), slightly generous',
    },
    searchBias: {
      value: [100.5018, 13.7563],
      source: 'assumption: central Bangkok (Democracy Monument), used only to rank nearer places first',
    },
    transit: {
      platformModes: {
        value: ['train', 'subway', 'light_rail', 'monorail'],
        source:
          'OSM public_transport=platform modes of Bangkok mass transit: BTS and MRT are tagged subway, the Gold Line light_rail, the Pink and Yellow lines monorail, the Airport Rail Link and Red Line train (Overpass, 2026-11-20). train also matches SRT intercity platforms, which OSM does not tag apart',
      },
      stationNodeTypes: {
        value: ['subway', 'light_rail', 'monorail'],
        source:
          'OSM station=* values on Bangkok BTS, MRT, Gold Line and monorail station nodes (Overpass, 2026-11-20); Airport Rail Link and Red Line nodes carry only train=yes, like SRT intercity stations, so they are not used',
      },
    },
  },
} as const satisfies Record<RegionId, Region>

const RegionIdSchema = z.enum(Object.keys(REGIONS) as [RegionId, ...RegionId[]]).catch('bkk')

export const REGION: Region = REGIONS[RegionIdSchema.parse(process.env.NEXT_PUBLIC_REGION)]
