import { HIGHWAY_CLASSES, type HighwayClass } from './assumptions'
import { toLine } from './geometry'
import type { OverpassResponse, OverpassTags, OverpassWay } from './overpass-response'
import { resolveRoadGrade, resolveRoadWidth } from './road-width'
import type { Road } from './schema'

type Element = OverpassResponse['elements'][number]

function isHighwayClass(value: string | undefined): value is HighwayClass {
  return HIGHWAY_CLASSES.some((highway) => highway === value)
}

function namesOf(tags: OverpassTags): Pick<Road, 'name' | 'nameTh'> {
  return { ...(tags.name && { name: tags.name }), ...(tags['name:th'] && { nameTh: tags['name:th'] }) }
}

function toRoad(way: OverpassWay): Road | undefined {
  const highway = way.tags.highway
  const line = toLine(way.geometry)
  if (!isHighwayClass(highway) || !line || line.length < 2) return undefined
  return {
    id: `way/${way.id}`,
    line,
    ...namesOf(way.tags),
    highway,
    ...resolveRoadWidth(way.tags, highway),
    grade: resolveRoadGrade(way.tags),
  }
}

export function parseRoadElements(elements: Element[]): Road[] {
  return elements.flatMap((element) => {
    const road = element.type === 'way' ? toRoad(element) : undefined
    return road ? [road] : []
  })
}
