import { cacheLife } from 'next/cache'
import { REGIONS } from '@/region/regions'
import { loadPack } from '@/rules'
import { stationDistance, type RegionId } from '@/solve'
import { OSM_ATTRIBUTION, STATION_PLATFORM_RADIUS_M } from './assumptions'
import { expandBbox, type Bbox } from './bbox'
import { fetchOverpass, overpassQuery, type StationSearch } from './overpass'
import { parseOverpass } from './parse'
import type { Site } from './schema'

function stationSearch(bbox: Bbox, regionId: RegionId): StationSearch | null {
  const { transit, packId } = REGIONS[regionId]
  if (!transit) return null
  const marginM = (stationDistance(loadPack(packId))?.value ?? 0) + STATION_PLATFORM_RADIUS_M.value
  return { bbox: expandBbox(bbox, marginM), transit }
}

export async function loadSite(bbox: Bbox, regionId: RegionId): Promise<Site> {
  'use cache'
  cacheLife({ revalidate: 86_400, expire: 604_800 })
  const query = overpassQuery(bbox, stationSearch(bbox, regionId))
  return { bbox, ...parseOverpass(await fetchOverpass(query), REGIONS[regionId].transit), attribution: OSM_ATTRIBUTION }
}
