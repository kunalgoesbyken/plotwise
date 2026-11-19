import { PlaceErrorSchema, PlacesSchema, normaliseQuery, type Place } from './schema'

export const GEOCODE_ENDPOINT = '/api/geocode'

export class PlaceSearchError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

export type SearchPlacesOptions = { signal?: AbortSignal; fetchImpl?: typeof fetch }

async function failureOf(response: Response): Promise<PlaceSearchError> {
  const body = PlaceErrorSchema.safeParse(await response.json().catch(() => undefined))
  const message = body.success ? body.data.error : `Place search failed with HTTP ${response.status}`
  return new PlaceSearchError(message, response.status)
}

export async function searchPlaces(query: string, { signal, fetchImpl = fetch }: SearchPlacesOptions = {}): Promise<Place[]> {
  const params = new URLSearchParams({ q: normaliseQuery(query) })
  const response = await fetchImpl(`${GEOCODE_ENDPOINT}?${params}`, { signal })
  if (!response.ok) throw await failureOf(response)
  return PlacesSchema.parse(await response.json())
}
