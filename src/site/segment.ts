import type { Vec2 } from '@/geo/projection'

export type Segment = readonly [Vec2, Vec2]

export function subtract([ax, ay]: Vec2, [bx, by]: Vec2): Vec2 {
  return [ax - bx, ay - by]
}

export function dot([ax, ay]: Vec2, [bx, by]: Vec2): number {
  return ax * bx + ay * by
}

export function cross([ax, ay]: Vec2, [bx, by]: Vec2): number {
  return ax * by - ay * bx
}

export function length(vector: Vec2): number {
  return Math.hypot(vector[0], vector[1])
}

function distanceToSegment(point: Vec2, [start, end]: Segment): number {
  const direction = subtract(end, start)
  const lengthSquared = dot(direction, direction)
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, dot(subtract(point, start), direction) / lengthSquared))
  return length(subtract(point, [start[0] + direction[0] * t, start[1] + direction[1] * t]))
}

function crosses(a: Segment, b: Segment): boolean {
  const aDirection = subtract(a[1], a[0])
  const bDirection = subtract(b[1], b[0])
  const sideOfB = [cross(aDirection, subtract(b[0], a[0])), cross(aDirection, subtract(b[1], a[0]))]
  const sideOfA = [cross(bDirection, subtract(a[0], b[0])), cross(bDirection, subtract(a[1], b[0]))]
  return sideOfB[0] * sideOfB[1] < 0 && sideOfA[0] * sideOfA[1] < 0
}

export function distanceBetweenSegments(a: Segment, b: Segment): number {
  if (crosses(a, b)) return 0
  return Math.min(
    distanceToSegment(a[0], b),
    distanceToSegment(a[1], b),
    distanceToSegment(b[0], a),
    distanceToSegment(b[1], a),
  )
}
