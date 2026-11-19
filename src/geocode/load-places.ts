import { cacheLife } from 'next/cache'
import { PLACES_CACHE_S } from './assumptions'
import { fetchPlaces } from './photon'
import type { Place } from './schema'

export async function loadPlaces(query: string): Promise<Place[]> {
  'use cache'
  const { cdn, staleWhileRevalidate } = PLACES_CACHE_S.value
  cacheLife({ revalidate: cdn, expire: cdn + staleWhileRevalidate })
  return fetchPlaces(query)
}
