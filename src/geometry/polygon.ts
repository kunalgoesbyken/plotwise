import type { Vec2 } from '@/geo/projection'
import { GeometryError } from './errors'
import { LENGTH_TOLERANCE_M, MAX_COORDINATE_M } from './tolerance'
import { cross, distance, distanceToSegment, segmentDistance } from './vector'

declare const ringBrand: unique symbol

export type Loop = readonly Vec2[]
export type Ring = Loop & { readonly [ringBrand]: true }
export type Polygon = { readonly outer: Loop; readonly holes: readonly Loop[] }

const next = <T>(items: readonly T[], i: number): T => items[(i + 1) % items.length]

export function signedArea(loop: Loop): number {
  if (loop.length < 3) return 0
  let twice = 0
  for (let i = 1; i < loop.length - 1; i++) twice += cross(loop[0], loop[i], loop[i + 1])
  return twice / 2
}

export function polygonArea({ outer, holes }: Polygon): number {
  return holes.reduce((area, hole) => area - Math.abs(signedArea(hole)), Math.abs(signedArea(outer)))
}

export function totalArea(polygons: readonly Polygon[]): number {
  return polygons.reduce((sum, polygon) => sum + polygonArea(polygon), 0)
}

export function edgeLengths(loop: Loop): number[] {
  return loop.map((point, i) => distance(point, next(loop, i)))
}

export function centroid(loop: Loop): Vec2 {
  const [ox, oy] = loop[0]
  let [twiceArea, sx, sy] = [0, 0, 0]
  for (let i = 1; i < loop.length - 1; i++) {
    const [[ax, ay], [bx, by]] = [loop[i], loop[i + 1]]
    const weight = cross(loop[0], loop[i], loop[i + 1])
    twiceArea += weight
    sx += weight * (ax + bx - 2 * ox)
    sy += weight * (ay + by - 2 * oy)
  }
  return [ox + sx / (3 * twiceArea), oy + sy / (3 * twiceArea)]
}

export function contains(loop: Loop, point: Vec2): boolean {
  if (loop.some((a, i) => distanceToSegment(point, a, next(loop, i)) <= LENGTH_TOLERANCE_M)) return true
  const [px, py] = point
  return loop.reduce((inside, [ax, ay], i) => {
    const [bx, by] = next(loop, i)
    const straddles = ay > py !== by > py
    return straddles && px < ax + ((py - ay) * (bx - ax)) / (by - ay) ? !inside : inside
  }, false)
}

function withoutDuplicates(points: readonly Vec2[]): Vec2[] {
  const kept = points.reduce<Vec2[]>((acc, p) => {
    if (acc.length === 0 || distance(acc[acc.length - 1], p) >= LENGTH_TOLERANCE_M) acc.push(p)
    return acc
  }, [])
  while (kept.length > 1 && distance(kept[0], kept[kept.length - 1]) < LENGTH_TOLERANCE_M) kept.pop()
  return kept
}

function isFlat(previous: Vec2, vertex: Vec2, following: Vec2): boolean {
  const base = distance(previous, following)
  return base < LENGTH_TOLERANCE_M || Math.abs(cross(previous, following, vertex)) / base < LENGTH_TOLERANCE_M
}

function flatVertex(ring: readonly Vec2[]): number {
  return ring.findIndex((vertex, i) => isFlat(ring[(i + ring.length - 1) % ring.length], vertex, next(ring, i)))
}

function withoutRedundantVertices(points: readonly Vec2[]): Vec2[] {
  let ring = withoutDuplicates(points)
  for (let flat = flatVertex(ring); ring.length >= 3 && flat >= 0; flat = flatVertex(ring)) {
    ring = withoutDuplicates(ring.filter((_, i) => i !== flat))
  }
  return ring
}

function selfIntersects(ring: readonly Vec2[]): boolean {
  const n = ring.length
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n - (i === 0 ? 1 : 0); j++) {
      if (segmentDistance(ring[i], next(ring, i), ring[j], next(ring, j)) < LENGTH_TOLERANCE_M) return true
    }
  }
  return false
}

export function normalizeRing(points: readonly Vec2[]): Ring {
  if (!points.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))) {
    throw new GeometryError('non-finite', 'every corner needs finite coordinates')
  }
  if (points.some(([x, y]) => Math.abs(x) > MAX_COORDINATE_M || Math.abs(y) > MAX_COORDINATE_M)) {
    throw new GeometryError('out-of-range', `corners must lie within ${MAX_COORDINATE_M} m of the local origin`)
  }
  const ring = withoutRedundantVertices(points)
  if (ring.length < 3) throw new GeometryError('degenerate', 'the outline has fewer than three distinct corners')
  if (selfIntersects(ring)) throw new GeometryError('self-intersecting', 'the outline crosses or touches itself')
  const counterClockwise: Loop = signedArea(ring) > 0 ? ring : [ring[0], ...ring.slice(1).reverse()]
  return counterClockwise as Ring
}
