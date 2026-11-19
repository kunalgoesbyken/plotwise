import type { LngLat } from '@/geo/projection'
import { HIGHWAY_CLASSES, type HighwayClass } from './assumptions'
import { namesOf, toLine } from './geometry'
import type { OverpassResponse, OverpassTags, OverpassWay } from './overpass-response'
import { resolveRoadGrade, resolveRoadWidth } from './road-width'
import type { Road } from './schema'

type Element = OverpassResponse['elements'][number]

function isHighwayClass(value: string | undefined): value is HighwayClass {
  return HIGHWAY_CLASSES.some((highway) => highway === value)
}

const ONE_WAY_FORWARD = ['yes', '1', 'true']
const ONE_WAY_BACKWARD = '-1'

function labelsOf(tags: OverpassTags): Pick<Road, 'name' | 'nameTh' | 'ref'> {
  return { ...namesOf(tags), ...(tags.ref && { ref: tags.ref }) }
}

function inTravelDirection(line: LngLat[], tags: OverpassTags): Pick<Road, 'line' | 'oneway'> {
  if (tags.oneway === ONE_WAY_BACKWARD) return { line: line.toReversed(), oneway: true }
  return { line, oneway: ONE_WAY_FORWARD.includes(tags.oneway ?? '') }
}

function toRoad(way: OverpassWay): Road | undefined {
  const highway = way.tags.highway
  const line = toLine(way.geometry)
  if (!isHighwayClass(highway) || !line || line.length < 2) return undefined
  return {
    id: `way/${way.id}`,
    ...labelsOf(way.tags),
    highway,
    ...resolveRoadWidth(way.tags, highway),
    grade: resolveRoadGrade(way.tags),
    ...inTravelDirection(line, way.tags),
  }
}

export function parseRoadElements(elements: Element[]): Road[] {
  return elements.flatMap((element) => {
    const road = element.type === 'way' ? toRoad(element) : undefined
    return road ? [road] : []
  })
}
