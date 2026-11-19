import type { Vec2 } from '@/geo/projection'

export function distance([ax, ay]: Vec2, [bx, by]: Vec2): number {
  return Math.hypot(bx - ax, by - ay)
}

export function cross([ox, oy]: Vec2, [ax, ay]: Vec2, [bx, by]: Vec2): number {
  return (ax - ox) * (by - oy) - (bx - ox) * (ay - oy)
}

export function distanceToSegment([px, py]: Vec2, [ax, ay]: Vec2, [bx, by]: Vec2): number {
  const dx = bx - ax
  const dy = by - ay
  const lengthSq = dx * dx + dy * dy
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq))
  const ex = px - ax - t * dx
  const ey = py - ay - t * dy
  return Math.sqrt(ex * ex + ey * ey)
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
