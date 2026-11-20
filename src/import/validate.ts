import { localFrame, type LngLat } from '@/geo/projection'
import { GeometryError, normalizeRing, polygonArea, type GeometryErrorReason } from '@/geometry'
import { LngLatSchema, MAX_CORNERS } from '@/plot/plot'
import { ASSUMPTIONS } from '@/solve'
import { locate } from './georef'
import { fail, succeed, type Georef, type ProblemReason, type Result, type Shape } from './types'

export type Bounds = readonly [minLng: number, minLat: number, maxLng: number, maxLat: number]

export const EARTH: Bounds = [-180, -90, 180, 90]

export type Checked = { ring: LngLat[]; areaSqm: number }

const REASON_FOR: Partial<Record<GeometryErrorReason, ProblemReason>> = {
  'self-intersecting': 'crossing',
  degenerate: 'degenerate',
}

export const isOnEarth = (at: LngLat) => LngLatSchema.safeParse(at).success

export const isInside = ([lng, lat]: LngLat, [minLng, minLat, maxLng, maxLat]: Bounds) =>
  lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat

function localOutline(ring: readonly LngLat[]) {
  const frame = localFrame(ring[0])
  return ring.map(frame.toLocal)
}

export function shapeAreaSqm(shape: Shape, georef: Georef): number {
  const ring = locate(shape.points, georef)
  return ring.length < 3 ? 0 : polygonArea({ outer: localOutline(ring), holes: [] })
}

function geometryProblem(outline: ReturnType<typeof localOutline>): ProblemReason | null {
  try {
    normalizeRing(outline)
    return null
  } catch (error) {
    if (!(error instanceof GeometryError)) throw error
    return REASON_FOR[error.reason] ?? 'out-of-range'
  }
}

function sizeProblem(areaSqm: number): ProblemReason | null {
  if (areaSqm < ASSUMPTIONS.importMinPlotSqm.value) return 'too-small'
  return areaSqm > ASSUMPTIONS.importMaxPlotSqm.value ? 'too-large' : null
}

export function shapeProblem(shape: Shape): ProblemReason | null {
  if (shape.curved) return 'dxf-curved'
  return shape.closed ? null : 'open-ring'
}

export function checkShape(shape: Shape, georef: Georef, bounds: Bounds): Result<Checked> {
  const unusable = shapeProblem(shape)
  if (unusable) return fail(unusable)
  if (shape.points.length < 3) return fail('too-few-corners')
  if (shape.points.length > MAX_CORNERS) return fail('too-many-corners')
  const ring = locate(shape.points, georef)
  if (!ring.every(isOnEarth)) return fail('out-of-range')
  if (!ring.every((at) => isInside(at, bounds))) return fail('outside-region')
  const outline = localOutline(ring)
  const problem = geometryProblem(outline)
  if (problem) return fail(problem)
  const areaSqm = polygonArea({ outer: outline, holes: [] })
  const tooSmallOrLarge = sizeProblem(areaSqm)
  return tooSmallOrLarge ? fail(tooSmallOrLarge) : succeed({ ring, areaSqm })
}
