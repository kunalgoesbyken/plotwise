import { z } from 'zod'
import type { LngLat } from '@/geo/projection'
import type { PackId } from '@/rules'
import type { Assumption } from '@/site/assumptions'
import type { Bbox } from '@/site/bbox'
import type { RegionId } from '@/solve'
import type { AreaUnit } from '@/units/area'

export type RulesSource = 'pack' | 'affectionPlan' | 'custom'

export type Transit = {
  readonly platformModes: Assumption<readonly string[]>
  readonly stationNodeTypes: Assumption<readonly string[]>
}

export type Region = {
  readonly id: RegionId
  readonly name: string
  readonly city: string | null
  readonly country: string | null
  readonly packId: PackId
  readonly rules: RulesSource
  readonly areaUnit: AreaUnit
  readonly zone: { readonly name: string; readonly scope: string } | null
  readonly authority: string
  readonly cityPlan: { readonly name: string; readonly version: string; readonly url: string } | null
  readonly areaTerms: { readonly ratio: string; readonly ratioName: string }
  readonly mapStart: Assumption<{ readonly centre: LngLat; readonly zoom: number }>
  readonly bounds: Assumption<Bbox> | null
  readonly searchBias: Assumption<LngLat> | null
  readonly transit: Transit | null
}

const FAR_TERMS = { ratio: 'FAR', ratioName: 'Floor area ratio' } as const

const STREET_ZOOM = 17

export const REGIONS = {
  bkk: {
    id: 'bkk',
    name: 'Bangkok',
    city: 'Bangkok',
    country: 'Thailand',
    packId: 'bkk-y9',
    rules: 'pack',
    areaUnit: 'sqm',
    zone: {
      name: 'Brown zone · very high-density residential',
      scope: 'Plotwise covers only this zone of the Bangkok city plan.',
    },
    authority: 'the BMA',
    cityPlan: { name: 'BMA city plan', version: 'Bangkok Comprehensive Plan B.E. 2556 (2013)', url: 'https://webportal.bangkok.go.th/cpud' },
    areaTerms: FAR_TERMS,
    mapStart: { value: { centre: [100.5268, 13.7236], zoom: STREET_ZOOM }, source: 'assumption: opening map view over central Bangkok' },
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
  dxb: {
    id: 'dxb',
    name: 'Dubai',
    city: 'Dubai',
    country: 'the Emirate of Dubai',
    packId: 'dxb-ap',
    rules: 'affectionPlan',
    areaUnit: 'sqft',
    zone: null,
    authority: 'the authority that issued the affection plan',
    cityPlan: null,
    areaTerms: FAR_TERMS,
    mapStart: { value: { centre: [55.2744, 25.1972], zoom: STREET_ZOOM }, source: 'assumption: opening map view over Downtown Dubai' },
    bounds: {
      value: [54.85, 24.6, 56.25, 25.4],
      source: 'approximate extent of the Emirate of Dubai, Hatta included (minLng, minLat, maxLng, maxLat), slightly generous',
    },
    searchBias: {
      value: [55.2744, 25.1972],
      source: 'assumption: Downtown Dubai, used only to rank nearer places first',
    },
    transit: null,
  },
  custom: {
    id: 'custom',
    name: 'Custom rules',
    city: null,
    country: null,
    packId: 'custom',
    rules: 'custom',
    areaUnit: 'sqm',
    zone: null,
    authority: 'your local planning authority',
    cityPlan: null,
    areaTerms: FAR_TERMS,
    mapStart: {
      value: { centre: [0, 20], zoom: 1.5 },
      source: 'assumption: custom rules apply anywhere, so the map opens on the whole world and moves to the place searched or drawn',
    },
    bounds: null,
    searchBias: null,
    transit: null,
  },
} as const satisfies Record<RegionId, Region>

export const REGION_IDS = Object.keys(REGIONS) as [RegionId, ...RegionId[]]

export const RegionIdSchema = z.enum(REGION_IDS, { error: `region must be one of ${REGION_IDS.join(', ')}` })

export const DEFAULT_REGION = REGIONS.bkk

export const regionParam = (value: string | null) => RegionIdSchema.safeParse(value ?? DEFAULT_REGION.id)
