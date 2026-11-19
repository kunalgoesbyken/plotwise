import { getPosition } from 'suncalc'
import type { LngLat } from '@/geo/projection'
import type { Vec3 } from './framing'

const MORNING_SOLAR_HOUR = 10
const DEGREES_PER_HOUR = 15
const MS_PER_HOUR = 3_600_000
const RAD = Math.PI / 180

export function solarMorning(day: Date, [lng]: LngLat): Date {
  const midnightUtc = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate())
  return new Date(midnightUtc + (MORNING_SOLAR_HOUR - lng / DEGREES_PER_HOUR) * MS_PER_HOUR)
}

export function sunDirection(at: Date, [lng, lat]: LngLat): Vec3 {
  const { azimuth, altitude } = getPosition(at, lat, lng)
  const across = Math.cos(altitude * RAD)
  return [Math.sin(azimuth * RAD) * across, Math.cos(azimuth * RAD) * across, Math.sin(altitude * RAD)]
}
