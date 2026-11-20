import type { Transit } from '@/region/regions'
import { namesOf, toLine } from './geometry'
import type { OverpassNode, OverpassResponse, OverpassTags, OverpassWay } from './overpass-response'
import { isClosed, toOpenRing } from './ring'
import type { Station, StationGeometry } from './schema'

const englishName = (tags: OverpassTags) => {
  const { name } = namesOf(tags)
  return name ? { name } : {}
}

type Element = OverpassResponse['elements'][number]

function isPlatform(tags: OverpassTags, transit: Transit): boolean {
  if (tags.railway === 'platform') return true
  return tags.public_transport === 'platform' && transit.platformModes.value.some((mode) => tags[mode] === 'yes')
}

function isStation(tags: OverpassTags, transit: Transit): boolean {
  return tags.railway === 'station' && transit.stationNodeTypes.value.includes(tags.station ?? '')
}

function wayGeometry(way: OverpassWay): StationGeometry | undefined {
  const line = toLine(way.geometry)
  if (!line || line.length < 2) return undefined
  if (!isClosed(line)) return { type: 'line', line }
  const ring = toOpenRing(line)
  return ring && { type: 'area', ring }
}

function nodeKind(tags: OverpassTags, transit: Transit): Station['kind'] | undefined {
  if (isPlatform(tags, transit)) return 'platform'
  return isStation(tags, transit) ? 'station' : undefined
}

function fromNode(node: OverpassNode, transit: Transit): Station | undefined {
  const kind = nodeKind(node.tags, transit)
  if (!kind) return undefined
  return { id: `node/${node.id}`, ...englishName(node.tags), kind, geometry: { type: 'point', at: [node.lon, node.lat] } }
}

function fromWay(way: OverpassWay, transit: Transit): Station | undefined {
  const geometry = isPlatform(way.tags, transit) ? wayGeometry(way) : undefined
  return geometry && { id: `way/${way.id}`, ...englishName(way.tags), kind: 'platform', geometry }
}

function toStation(element: Element, transit: Transit): Station | undefined {
  if (element.type === 'node') return fromNode(element, transit)
  return element.type === 'way' ? fromWay(element, transit) : undefined
}

export function parseStationElements(elements: Element[], transit: Transit): Station[] {
  return elements.flatMap((element) => {
    const station = toStation(element, transit)
    return station ? [station] : []
  })
}
