import type { Vec2 } from '@/geo/projection'
import { GeometryError } from './errors'
import { cross, distance } from './vector'

export type OrientedRect = {
  readonly center: Vec2
  readonly axis: Vec2
  readonly lengthM: number
  readonly widthM: number
  readonly corners: readonly [Vec2, Vec2, Vec2, Vec2]
}

function halfHull(points: readonly Vec2[]): Vec2[] {
  return points.reduce<Vec2[]>((chain, point) => {
    while (chain.length >= 2 && cross(chain[chain.length - 2], chain[chain.length - 1], point) <= 0) chain.pop()
    chain.push(point)
    return chain
  }, [])
}

function convexHull(points: readonly Vec2[]): Vec2[] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  return [...halfHull(sorted).slice(0, -1), ...halfHull([...sorted].reverse()).slice(0, -1)]
}

function edgeDirections(hull: readonly Vec2[]): Vec2[] {
  const directions = hull.flatMap((point, i): Vec2[] => {
    const following = hull[(i + 1) % hull.length]
    const length = distance(point, following)
    return length > 0 ? [[(following[0] - point[0]) / length, (following[1] - point[1]) / length]] : []
  })
  return directions.length > 0 ? directions : [[1, 0]]
}

const canonical = ([x, y]: Vec2): Vec2 => (x > 0 || (x === 0 && y > 0) ? [x, y] : [-x, -y])

function rectAlong(points: readonly Vec2[], direction: Vec2): OrientedRect {
  const normal: Vec2 = [-direction[1], direction[0]]
  const along = points.map(([x, y]) => x * direction[0] + y * direction[1])
  const across = points.map(([x, y]) => x * normal[0] + y * normal[1])
  const [alongMin, alongMax, acrossMin, acrossMax] = [Math.min(...along), Math.max(...along), Math.min(...across), Math.max(...across)]
  const [mid, midAcross] = [(alongMin + alongMax) / 2, (acrossMin + acrossMax) / 2]
  const center: Vec2 = [mid * direction[0] + midAcross * normal[0], mid * direction[1] + midAcross * normal[1]]
  const alongIsLonger = alongMax - alongMin >= acrossMax - acrossMin
  const axis = canonical(alongIsLonger ? direction : normal)
  const [lengthM, widthM] = alongIsLonger
    ? [alongMax - alongMin, acrossMax - acrossMin]
    : [acrossMax - acrossMin, alongMax - alongMin]
  const corner = (sAlong: number, sAcross: number): Vec2 => [
    center[0] + (sAlong * lengthM * axis[0] - sAcross * widthM * axis[1]) / 2,
    center[1] + (sAlong * lengthM * axis[1] + sAcross * widthM * axis[0]) / 2,
  ]
  return { center, axis, lengthM, widthM, corners: [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)] }
}

export function minAreaRect(points: readonly Vec2[]): OrientedRect {
  if (points.length === 0) throw new GeometryError('degenerate', 'cannot box an empty set of points')
  const hull = convexHull(points)
  const candidates = hull.length > 0 ? hull : points
  return edgeDirections(hull)
    .map((direction) => rectAlong(candidates, direction))
    .reduce((best, rect) => (rect.lengthM * rect.widthM < best.lengthM * best.widthM ? rect : best))
}
