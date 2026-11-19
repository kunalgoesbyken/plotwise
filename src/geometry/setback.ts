import type { Vec2 } from '@/geo/projection'
import { difference } from './clip'
import { GeometryError } from './errors'
import type { Polygon, Ring } from './polygon'
import { ARC_TOLERANCE_M } from './tolerance'

function polar([x, y]: Vec2, radius: number, angle: number): Vec2 {
  return [x + radius * Math.cos(angle), y + radius * Math.sin(angle)]
}

function halfCircle(centre: Vec2, radius: number, from: number): Vec2[] {
  const steps = Math.ceil(Math.PI / (2 * Math.acos(radius / (radius + ARC_TOLERANCE_M))))
  const step = Math.PI / steps
  const reach = radius / Math.cos(step / 2)
  return [
    polar(centre, radius, from),
    ...Array.from({ length: steps }, (_, k) => polar(centre, reach, from + (k + 0.5) * step)),
    polar(centre, radius, from + Math.PI),
  ]
}

function edgeBuffer(start: Vec2, end: Vec2, radius: number): Polygon {
  const heading = Math.atan2(end[1] - start[1], end[0] - start[0])
  return {
    outer: [...halfCircle(end, radius, heading - Math.PI / 2), ...halfCircle(start, radius, heading + Math.PI / 2)],
    holes: [],
  }
}

function assertSetbacks(plot: Ring, setbacks: readonly number[]): void {
  if (setbacks.length !== plot.length) {
    throw new GeometryError('invalid-setbacks', `expected ${plot.length} setbacks, one per edge, got ${setbacks.length}`)
  }
  if (!setbacks.every((d) => Number.isFinite(d) && d >= 0)) {
    throw new GeometryError('invalid-setbacks', 'setbacks must be finite and non-negative')
  }
}

function boundingDiagonal(plot: Ring): number {
  const xs = plot.map(([x]) => x)
  const ys = plot.map(([, y]) => y)
  return Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
}

export function setbackEnvelope(plot: Ring, setbacks: readonly number[]): Polygon[] {
  assertSetbacks(plot, setbacks)
  const reach = boundingDiagonal(plot)
  const buffers = plot.flatMap((start, i) =>
    setbacks[i] > 0 ? [edgeBuffer(start, plot[(i + 1) % plot.length], Math.min(setbacks[i], reach))] : [],
  )
  return difference([{ outer: plot, holes: [] }], buffers)
}
