import type { LngLat } from '@/geo/projection'
import type { OverpassTags, OverpassWay } from './overpass-response'

export function namesOf(tags: OverpassTags): { name?: string; nameTh?: string } {
  return { ...(tags.name && { name: tags.name }), ...(tags['name:th'] && { nameTh: tags['name:th'] }) }
}

export function toLine(geometry: OverpassWay['geometry']): LngLat[] | undefined {
  if (!geometry) return undefined
  const line = geometry.flatMap((point): LngLat[] => (point ? [[point.lon, point.lat]] : []))
  return line.length === geometry.length ? line : undefined
}
