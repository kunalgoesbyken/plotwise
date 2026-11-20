import { localFrame, type LngLat } from '@/geo/projection'
import type { Georef, Pair } from './types'
import { utmToLngLat } from './utm'

type Absolute = Exclude<Georef, { kind: 'reference' }>
type Reference = Extract<Georef, { kind: 'reference' }>

function absolute([first, second]: Pair, georef: Absolute): LngLat {
  if (georef.kind === 'degrees') return georef.order === 'lng-lat' ? [first, second] : [second, first]
  const [easting, northing] = georef.order === 'east-north' ? [first, second] : [second, first]
  const { zone, hemisphere, unitM } = georef
  return utmToLngLat({ zone, hemisphere, easting: easting * unitM, northing: northing * unitM })
}

function fromReference(points: readonly Pair[], { at, unitM }: Reference): LngLat[] {
  const frame = localFrame(at)
  const [x0, y0] = points[0]
  return points.map(([x, y]) => frame.toLngLat([(x - x0) * unitM, (y - y0) * unitM]))
}

export function locate(points: readonly Pair[], georef: Georef): LngLat[] {
  if (points.length === 0) return []
  return georef.kind === 'reference' ? fromReference(points, georef) : points.map((point) => absolute(point, georef))
}
