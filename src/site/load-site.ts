import { cacheLife } from 'next/cache'
import { REGION } from '@/region/regions'
import { loadPack } from '@/rules'
import { stationDistance } from '@/solve'
import { OSM_ATTRIBUTION, STATION_PLATFORM_RADIUS_M } from './assumptions'
import { expandBbox, type Bbox } from './bbox'
import { fetchOverpass, overpassQuery } from './overpass'
import { parseOverpass } from './parse'
import type { Site } from './schema'

const STATION_SEARCH_MARGIN_M = (stationDistance(loadPack(REGION.packId))?.value ?? 0) + STATION_PLATFORM_RADIUS_M.value

export async function loadSite(bbox: Bbox): Promise<Site> {
  'use cache'
  cacheLife({ revalidate: 86_400, expire: 604_800 })
  const query = overpassQuery(bbox, expandBbox(bbox, STATION_SEARCH_MARGIN_M))
  return { bbox, ...parseOverpass(await fetchOverpass(query)), attribution: OSM_ATTRIBUTION }
}
