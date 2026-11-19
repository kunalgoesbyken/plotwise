import type { LngLat } from '@/geo/projection'
import type { OverpassWay } from './overpass-response'

export function toLine(geometry: OverpassWay['geometry']): LngLat[] | undefined {
  if (!geometry) return undefined
  const line = geometry.flatMap((point): LngLat[] => (point ? [[point.lon, point.lat]] : []))
  return line.length === geometry.length ? line : undefined
}
