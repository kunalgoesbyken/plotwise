import type { LngLat } from '@/geo/projection'

type Segment = readonly [LngLat, LngLat]

function cross(o: LngLat, a: LngLat, b: LngLat) {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
}

function within(p: LngLat, [a, b]: Segment) {
  return (
    Math.min(a[0], b[0]) <= p[0] &&
    p[0] <= Math.max(a[0], b[0]) &&
    Math.min(a[1], b[1]) <= p[1] &&
    p[1] <= Math.max(a[1], b[1])
  )
}

function touches(s: Segment, t: Segment) {
  const d1 = Math.sign(cross(t[0], t[1], s[0]))
  const d2 = Math.sign(cross(t[0], t[1], s[1]))
  const d3 = Math.sign(cross(s[0], s[1], t[0]))
  const d4 = Math.sign(cross(s[0], s[1], t[1]))
  if (d1 * d2 < 0 && d3 * d4 < 0) return true
  return (
    (d1 === 0 && within(s[0], t)) ||
    (d2 === 0 && within(s[1], t)) ||
    (d3 === 0 && within(t[0], s)) ||
    (d4 === 0 && within(t[1], s))
  )
}

function foldsBack([p, q]: Segment, [, r]: Segment) {
  const dot = (p[0] - q[0]) * (r[0] - q[0]) + (p[1] - q[1]) * (r[1] - q[1])
  return cross(q, p, r) === 0 && dot > 0
}

function isDegenerate([a, b]: Segment) {
  return a[0] === b[0] && a[1] === b[1]
}

function segments(points: readonly LngLat[]): Segment[] {
  return points.slice(1).map((end, i) => [points[i], end] as const)
}

export function isSimplePath(points: readonly LngLat[]) {
  const path = segments(points)
  if (path.some(isDegenerate)) return false
  return path.every((segment, i) =>
    path.slice(i + 1).every((later, offset) => (offset === 0 ? !foldsBack(segment, later) : !touches(segment, later))),
  )
}
