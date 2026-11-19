import { z } from 'zod'
import { THAILAND_BBOX } from '@/site/assumptions'
import { USER_AGENT } from '@/site/user-agent'
import { SEARCH_BIAS_LNGLAT, SEARCH_RESULT_LIMIT } from './assumptions'
import { PLACE_KINDS, type Place } from './schema'

const PHOTON_URL = 'https://photon.komoot.io/api'
const TIMEOUT_MS = 6_000
const THAI_SCRIPT = /\p{Script=Thai}/u

const PropertiesSchema = z.object({
  osm_type: z.string(),
  osm_id: z.number(),
  type: z.enum(PLACE_KINDS).catch('other'),
  name: z.string().optional(),
  housenumber: z.string().optional(),
  street: z.string().optional(),
  locality: z.string().optional(),
  district: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
})

const PhotonResponseSchema = z.object({
  features: z.array(
    z.object({
      properties: PropertiesSchema,
      geometry: z.object({ type: z.literal('Point'), coordinates: z.tuple([z.number(), z.number()]) }),
    }),
  ),
})

type Language = 'en' | 'default'
type Feature = z.infer<typeof PhotonResponseSchema>['features'][number]
type Properties = Feature['properties']

export class PlaceSearchUnavailableError extends Error {}

export type FetchPlacesOptions = { timeoutMs?: number; fetchImpl?: typeof fetch }

function photonUrl(query: string, lang: Language): string {
  const [lon, lat] = SEARCH_BIAS_LNGLAT.value
  const params = new URLSearchParams({
    q: query,
    lang,
    lon: String(lon),
    lat: String(lat),
    bbox: THAILAND_BBOX.value.join(','),
    limit: String(SEARCH_RESULT_LIMIT.value),
  })
  return `${PHOTON_URL}?${params}`
}

async function queryPhoton(query: string, lang: Language, timeoutMs: number, fetchImpl: typeof fetch): Promise<Feature[]> {
  const response = await fetchImpl(photonUrl(query, lang), {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const body = PhotonResponseSchema.safeParse(await response.json())
  if (!body.success) throw new Error('unexpected response shape')
  return body.data.features
}

function idOf({ osm_type, osm_id }: Properties): string {
  return `${osm_type}${osm_id}`
}

function labelOf(properties: Properties): string {
  const { name, housenumber, street, locality, district, city, state } = properties
  const address = [housenumber, street].filter(Boolean).join(' ')
  const parts = [name, address, district ?? locality, city ?? state].filter((part): part is string => Boolean(part))
  return [...new Set(parts)].join(', ')
}

function thaiLabelOf(local: Feature | undefined, label: string): string | undefined {
  if (!local?.properties.name) return undefined
  const labelTh = labelOf(local.properties)
  return labelTh !== label && THAI_SCRIPT.test(labelTh) ? labelTh : undefined
}

function toPlace(feature: Feature, localById: ReadonlyMap<string, Feature>): Place | undefined {
  const { properties, geometry } = feature
  if (!properties.name && !properties.street) return undefined
  const id = idOf(properties)
  const label = labelOf(properties)
  const labelTh = thaiLabelOf(localById.get(id), label)
  return { id, label, ...(labelTh && { labelTh }), lngLat: geometry.coordinates, kind: properties.type }
}

export async function fetchPlaces(
  query: string,
  { timeoutMs = TIMEOUT_MS, fetchImpl = fetch }: FetchPlacesOptions = {},
): Promise<Place[]> {
  const [english, local] = await Promise.all([
    queryPhoton(query, 'en', timeoutMs, fetchImpl),
    queryPhoton(query, 'default', timeoutMs, fetchImpl),
  ]).catch((error: unknown) => {
    throw new PlaceSearchUnavailableError(`Place search is unavailable: ${error instanceof Error ? error.message : String(error)}`)
  })
  const localById = new Map(local.map((feature) => [idOf(feature.properties), feature]))
  return english.flatMap((feature) => {
    const place = toPlace(feature, localById)
    return place ? [place] : []
  })
}
