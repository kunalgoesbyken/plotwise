import type { Pair, Shape } from './types'

const samePoint = (a: Pair, b: Pair) => a[0] === b[0] && a[1] === b[1]

export function shapeOf(name: string | null, points: readonly Pair[], declaredClosed: boolean): Shape {
  const repeatsStart = points.length > 1 && samePoint(points[0], points[points.length - 1])
  return repeatsStart
    ? { name, points: points.slice(0, -1), closed: true, curved: false }
    : { name, points, closed: declaredClosed, curved: false }
}
