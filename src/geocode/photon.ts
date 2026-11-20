import { z } from 'zod'
import { THAILAND_BBOX } from '@/site/assumptions'
import { USER_AGENT } from '@/site/user-agent'
import { SEARCH_BIAS_LNGLAT, SEARCH_RESULT_LIMIT } from './assumptions'
import { PLACE_KINDS, type Place } from './schema'

const PHOTON_URL = 'https://photon.komoot.io/api'
const TIMEOUT_MS = 6_000

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

type Feature = z.infer<typeof PhotonResponseSchema>['features'][number]
type Properties = Feature['properties']

export class PlaceSearchUnavailableError extends Error {}

export type FetchPlacesOptions = { timeoutMs?: number; fetchImpl?: typeof fetch }

function photonUrl(query: string): string {
  const [lon, lat] = SEARCH_BIAS_LNGLAT.value
  const params = new URLSearchParams({
    q: query,
    lang: 'en',
    lon: String(lon),
    lat: String(lat),
    bbox: THAILAND_BBOX.value.join(','),
    limit: String(SEARCH_RESULT_LIMIT.value),
  })
  return `${PHOTON_URL}?${params}`
}

async function queryPhoton(query: string, timeoutMs: number, fetchImpl: typeof fetch): Promise<Feature[]> {
  const response = await fetchImpl(photonUrl(query), {
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

function toPlace({ properties, geometry }: Feature): Place | undefined {
  if (!properties.name && !properties.street) return undefined
  return { id: idOf(properties), label: labelOf(properties), lngLat: geometry.coordinates, kind: properties.type }
}

export async function fetchPlaces(
  query: string,
  { timeoutMs = TIMEOUT_MS, fetchImpl = fetch }: FetchPlacesOptions = {},
): Promise<Place[]> {
  const features = await queryPhoton(query, timeoutMs, fetchImpl).catch((error: unknown) => {
    throw new PlaceSearchUnavailableError(`Place search is unavailable: ${error instanceof Error ? error.message : String(error)}`)
  })
  return features.flatMap((feature) => toPlace(feature) ?? [])
}
