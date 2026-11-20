import { localFrame, type LngLat } from '@/geo/projection'
import { edgeLengths, signedArea } from '@/geometry'
import { ZONE_COORDINATE_DECIMALS, ZONE_GENERALISATION_DEGREES, ZONE_SLIVER_SHARE } from './assumptions'

const STEP_DEGREES = 10 ** -ZONE_COORDINATE_DECIMALS.value
const ROUNDING_DEGREES = Math.SQRT1_2 * STEP_DEGREES

export function generalisationDegrees(plot: readonly LngLat[]): number {
  const frame = localFrame(plot[0])
  const loop = plot.map(frame.toLocal)
  const halfPerimeterM = edgeLengths(loop).reduce((sum, m) => sum + m, 0) / 2
  const allowedShiftM = (ZONE_SLIVER_SHARE.value * Math.abs(signedArea(loop))) / halfPerimeterM
  const metresPerDegree = frame.toLocal([frame.origin[0], frame.origin[1] + 1])[1]
  const fitting = Math.floor((allowedShiftM / metresPerDegree - ROUNDING_DEGREES) / STEP_DEGREES) * STEP_DEGREES
  return Math.max(0, Math.min(ZONE_GENERALISATION_DEGREES.value, fitting))
}
