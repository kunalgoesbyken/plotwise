import type { Transit } from '@/region/regions'
import { parseBuildingElements } from './buildings'
import { dropCoveredOutlines } from './coverage'
import type { OverpassResponse } from './overpass-response'
import { parseRoadElements } from './roads'
import type { SiteData } from './schema'
import { parseStationElements } from './stations'

export function parseOverpass({ elements }: OverpassResponse, transit: Transit | null): SiteData {
  const { outlines, parts } = parseBuildingElements(elements)
  return {
    buildings: [...dropCoveredOutlines(outlines, parts), ...parts],
    roads: parseRoadElements(elements),
    stations: transit ? parseStationElements(elements, transit) : [],
  }
}
