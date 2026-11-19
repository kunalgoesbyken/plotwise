import { cacheLife } from 'next/cache'
import { OSM_ATTRIBUTION } from './assumptions'
import type { Bbox } from './bbox'
import { fetchOverpass } from './overpass'
import { parseOverpass } from './parse'
import type { Site } from './schema'

export async function loadSite(bbox: Bbox): Promise<Site> {
  'use cache'
  cacheLife({ revalidate: 86_400, expire: 604_800 })
  return { bbox, ...parseOverpass(await fetchOverpass(bbox)), attribution: OSM_ATTRIBUTION }
}
