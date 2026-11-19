import type { Loop } from '@/geometry'
import { extentOf } from './extent'

export type Vec3 = readonly [x: number, y: number, z: number]
export type Framing = { readonly target: Vec3; readonly radiusM: number }

const MIN_RADIUS_M = 50
const DISTANCE_PER_RADIUS = 4.5
const ELEVATION_RAD = (2 * Math.PI) / 9
const BEARING_RAD = (7 * Math.PI) / 6
const REFRAME_SHARE = 0.25
const RADIUS_PER_HEIGHT = 0.6

export function framingOf(ring: Loop, heightM: number): Framing {
  const [minX, minY, maxX, maxY] = extentOf(ring)
  return {
    target: [(minX + maxX) / 2, (minY + maxY) / 2, heightM / 3],
    radiusM: Math.max(Math.hypot(maxX - minX, maxY - minY) / 2, heightM * RADIUS_PER_HEIGHT, MIN_RADIUS_M),
  }
}

export function cameraPosition({ target: [x, y, z], radiusM }: Framing): Vec3 {
  const distance = radiusM * DISTANCE_PER_RADIUS
  const across = distance * Math.cos(ELEVATION_RAD)
  return [x + across * Math.sin(BEARING_RAD), y + across * Math.cos(BEARING_RAD), z + distance * Math.sin(ELEVATION_RAD)]
}

export function needsReframe(shown: Framing, next: Framing): boolean {
  const [dx, dy, dz] = next.target.map((value, i) => value - shown.target[i])
  const tolerance = shown.radiusM * REFRAME_SHARE
  return Math.hypot(dx, dy, dz) > tolerance || Math.abs(next.radiusM - shown.radiusM) > tolerance
}
