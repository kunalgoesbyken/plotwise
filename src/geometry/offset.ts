import type { Vec2 } from '@/geo/projection'
import { GeometryError } from './errors'
import { normalizeRing, type Ring } from './polygon'
import { LENGTH_TOLERANCE_M } from './tolerance'
import { dot, length, subtract } from './vector'

type Line = { readonly point: Vec2; readonly direction: Vec2 }

function shiftedLine(ring: Ring, i: number, depthM: number): Line {
  const [from, to] = [ring[i], ring[(i + 1) % ring.length]]
  const span = subtract(to, from)
  const direction: Vec2 = [span[0] / length(span), span[1] / length(span)]
  return { point: [from[0] - direction[1] * depthM, from[1] + direction[0] * depthM], direction }
}

function crossing(a: Line, b: Line): Vec2 {
  const turn = a.direction[0] * b.direction[1] - a.direction[1] * b.direction[0]
  if (Math.abs(turn) < LENGTH_TOLERANCE_M) throw new GeometryError('invalid-reservation', 'two neighbouring edges run parallel')
  const gap = subtract(b.point, a.point)
  const along = (gap[0] * b.direction[1] - gap[1] * b.direction[0]) / turn
  return [a.point[0] + a.direction[0] * along, a.point[1] + a.direction[1] * along]
}

export function offsetEdges(ring: Ring, depthsM: readonly number[]): Ring {
  if (depthsM.length !== ring.length || !depthsM.every((d) => Number.isFinite(d) && d >= 0)) {
    throw new GeometryError('invalid-reservation', 'expected one non-negative depth per edge')
  }
  const lines = ring.map((_, i) => shiftedLine(ring, i, depthsM[i]))
  const corners = lines.map((line, i) => crossing(lines[(i + lines.length - 1) % lines.length], line))
  const keepsDirection = corners.every((corner, i) => {
    const span = subtract(corners[(i + 1) % corners.length], corner)
    return dot(span, lines[i].direction) > LENGTH_TOLERANCE_M
  })
  if (!keepsDirection) throw new GeometryError('invalid-reservation', 'the strips are deeper than the plot allows')
  const offset = normalizeRing(corners)
  if (offset.length !== ring.length) throw new GeometryError('invalid-reservation', 'the strips merge two edges of the plot')
  return offset
}
