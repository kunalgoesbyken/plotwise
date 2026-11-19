import type { LngLat } from '@/geo/projection'
import { resolveBuildingHeight } from './building-height'
import { toLine } from './geometry'
import type { OverpassResponse, OverpassRelation, OverpassTags, OverpassWay } from './overpass-response'
import { assembleRings, groupHoles, toOpenRing, type RingGroup } from './ring'
import type { Building } from './schema'

type Element = OverpassResponse['elements'][number]
type BuildingKind = 'outline' | 'part'

export type ParsedBuildings = { outlines: Building[]; parts: Building[] }

function kindOf(tags: OverpassTags): BuildingKind | undefined {
  if (tags['building:part'] && tags['building:part'] !== 'no') return 'part'
  if (tags.building && tags.building !== 'no') return 'outline'
  return undefined
}

function wayGroups(way: OverpassWay): RingGroup[] {
  const line = toLine(way.geometry)
  const ring = line && toOpenRing(line)
  return ring ? groupHoles([ring], []) : []
}

function memberLines(relation: OverpassRelation, role: string): LngLat[][] {
  return relation.members
    .filter((member) => member.type === 'way' && member.role === role)
    .map((member) => toLine(member.geometry))
    .filter((line): line is LngLat[] => line !== undefined)
}

function relationGroups(relation: OverpassRelation): RingGroup[] {
  return groupHoles(assembleRings(memberLines(relation, 'outer')), assembleRings(memberLines(relation, 'inner')))
}

function buildingId(prefix: string, id: number, index: number, count: number): string {
  return count === 1 ? `${prefix}/${id}` : `${prefix}/${id}/${index}`
}

function toBuildings(prefix: string, id: number, tags: OverpassTags, groups: RingGroup[]): Building[] {
  const height = resolveBuildingHeight(tags)
  return groups.map((group, index) => ({
    id: buildingId(prefix, id, index, groups.length),
    outer: group.outer,
    holes: group.holes,
    ...height,
  }))
}

function parseElement(element: Element): { kind: BuildingKind; buildings: Building[] } | undefined {
  if (element.type === 'node') return undefined
  const kind = kindOf(element.tags)
  if (!kind) return undefined
  const groups = element.type === 'way' ? wayGroups(element) : relationGroups(element)
  return { kind, buildings: toBuildings(element.type, element.id, element.tags, groups) }
}

export function parseBuildingElements(elements: Element[]): ParsedBuildings {
  const parsed: ParsedBuildings = { outlines: [], parts: [] }
  elements.forEach((element) => {
    const result = parseElement(element)
    if (!result) return
    const target = result.kind === 'part' ? parsed.parts : parsed.outlines
    target.push(...result.buildings)
  })
  return parsed
}
