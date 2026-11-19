import { PLATFORM_MODES, STATION_NODE_TYPES } from './assumptions'
import { namesOf, toLine } from './geometry'
import type { OverpassNode, OverpassResponse, OverpassTags, OverpassWay } from './overpass-response'
import { isClosed, toOpenRing } from './ring'
import type { Station, StationGeometry } from './schema'

type Element = OverpassResponse['elements'][number]

function isPlatform(tags: OverpassTags): boolean {
  if (tags.railway === 'platform') return true
  return tags.public_transport === 'platform' && PLATFORM_MODES.value.some((mode) => tags[mode] === 'yes')
}

function isStation(tags: OverpassTags): boolean {
  return tags.railway === 'station' && STATION_NODE_TYPES.value.includes(tags.station ?? '')
}

function wayGeometry(way: OverpassWay): StationGeometry | undefined {
  const line = toLine(way.geometry)
  if (!line || line.length < 2) return undefined
  if (!isClosed(line)) return { type: 'line', line }
  const ring = toOpenRing(line)
  return ring && { type: 'area', ring }
}

function nodeKind(tags: OverpassTags): Station['kind'] | undefined {
  if (isPlatform(tags)) return 'platform'
  return isStation(tags) ? 'station' : undefined
}

function fromNode(node: OverpassNode): Station | undefined {
  const kind = nodeKind(node.tags)
  if (!kind) return undefined
  return { id: `node/${node.id}`, ...namesOf(node.tags), kind, geometry: { type: 'point', at: [node.lon, node.lat] } }
}

function fromWay(way: OverpassWay): Station | undefined {
  const geometry = isPlatform(way.tags) ? wayGeometry(way) : undefined
  return geometry && { id: `way/${way.id}`, ...namesOf(way.tags), kind: 'platform', geometry }
}

function toStation(element: Element): Station | undefined {
  if (element.type === 'node') return fromNode(element)
  return element.type === 'way' ? fromWay(element) : undefined
}

export function parseStationElements(elements: Element[]): Station[] {
  return elements.flatMap((element) => {
    const station = toStation(element)
    return station ? [station] : []
  })
}
