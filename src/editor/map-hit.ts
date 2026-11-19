import type { Vec2 } from '@/geo/projection'

export type Hit = { kind: 'corner'; index: number } | { kind: 'midpoint'; edge: number } | { kind: 'edge'; index: number }

function distanceToSegment([px, py]: Vec2, [ax, ay]: Vec2, [bx, by]: Vec2) {
  const [dx, dy] = [bx - ax, by - ay]
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

function nearest(distances: number[], reach: number) {
  let best = -1
  distances.forEach((d, i) => {
    if (d <= reach && (best < 0 || d < distances[best])) best = i
  })
  return best
}

export function pickTarget(points: readonly Vec2[], closed: boolean, pointer: Vec2, reach: number): Hit | null {
  const corner = nearest(
    points.map((p) => Math.hypot(p[0] - pointer[0], p[1] - pointer[1])),
    reach,
  )
  if (corner >= 0) return { kind: 'corner', index: corner }
  const edgeCount = closed ? points.length : Math.max(points.length - 1, 0)
  const ends = Array.from({ length: edgeCount }, (_, i) => [points[i], points[(i + 1) % points.length]] as const)
  if (closed) {
    const midpoint = nearest(
      ends.map(([a, b]) => Math.hypot((a[0] + b[0]) / 2 - pointer[0], (a[1] + b[1]) / 2 - pointer[1])),
      reach,
    )
    if (midpoint >= 0) return { kind: 'midpoint', edge: midpoint }
  }
  const edge = nearest(
    ends.map(([a, b]) => distanceToSegment(pointer, a, b)),
    reach,
  )
  return edge >= 0 ? { kind: 'edge', index: edge } : null
}
