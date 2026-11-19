import type { Vec2 } from '@/geo/projection'

export function distance([ax, ay]: Vec2, [bx, by]: Vec2): number {
  return Math.hypot(bx - ax, by - ay)
}

export function cross([ox, oy]: Vec2, [ax, ay]: Vec2, [bx, by]: Vec2): number {
  return (ax - ox) * (by - oy) - (bx - ox) * (ay - oy)
}

export function distanceToSegment(point: Vec2, a: Vec2, b: Vec2): number {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]]
  const lengthSq = dx * dx + dy * dy
  if (lengthSq === 0) return distance(point, a)
  const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / lengthSq))
  return distance(point, [a[0] + t * dx, a[1] + t * dy])
}

function crosses(a: Vec2, b: Vec2, c: Vec2, d: Vec2): boolean {
  return cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0
}

export function segmentDistance(a: Vec2, b: Vec2, c: Vec2, d: Vec2): number {
  if (crosses(a, b, c, d)) return 0
  return Math.min(distanceToSegment(a, c, d), distanceToSegment(b, c, d), distanceToSegment(c, a, b), distanceToSegment(d, a, b))
}

export function subtract([ax, ay]: Vec2, [bx, by]: Vec2): Vec2 {
  return [ax - bx, ay - by]
}

export function dot([ax, ay]: Vec2, [bx, by]: Vec2): number {
  return ax * bx + ay * by
}

export function length([x, y]: Vec2): number {
  return Math.hypot(x, y)
}
