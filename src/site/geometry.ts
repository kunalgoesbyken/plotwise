import type { LngLat } from '@/geo/projection'
import type { OverpassTags, OverpassWay } from './overpass-response'

const THAI_SCRIPT = /\p{Script=Thai}/u

export function namesOf(tags: OverpassTags): { name?: string; nameTh?: string } {
  const local = tags.name
  const localIsThai = local !== undefined && THAI_SCRIPT.test(local)
  const name = tags['name:en'] ?? (localIsThai ? undefined : local)
  const nameTh = tags['name:th'] ?? (localIsThai ? local : undefined)
  return { ...(name && { name }), ...(nameTh && { nameTh }) }
}

export function toLine(geometry: OverpassWay['geometry']): LngLat[] | undefined {
  if (!geometry) return undefined
  const line = geometry.flatMap((point): LngLat[] => (point ? [[point.lon, point.lat]] : []))
  return line.length === geometry.length ? line : undefined
}
