import { z } from 'zod'
import type { LngLat } from '@/geo/projection'

export const HEMISPHERES = ['N', 'S'] as const

export const UtmZoneSchema = z.object({
  zone: z.int().min(1).max(60),
  hemisphere: z.enum(HEMISPHERES),
})

export type UtmZone = z.infer<typeof UtmZoneSchema>
export type UtmPoint = UtmZone & { easting: number; northing: number }

export const MIN_UTM_EASTING_M = 100_000
export const MAX_UTM_EASTING_M = 900_000

const ZONE_WIDTH_DEG = 6
const WGS84_SEMI_MAJOR_M = 6_378_137
const WGS84_FLATTENING = 1 / 298.257_223_563
const CENTRAL_SCALE = 0.9996
const FALSE_EASTING_M = 500_000
const FALSE_NORTHING_SOUTH_M = 10_000_000

const N = WGS84_FLATTENING / (2 - WGS84_FLATTENING)
const N2 = N * N
const N3 = N2 * N
const N4 = N3 * N
const SCALED_RADIUS_M = CENTRAL_SCALE * (WGS84_SEMI_MAJOR_M / (1 + N)) * (1 + N2 / 4 + N4 / 64)

const BETA = [
  N / 2 - (2 * N2) / 3 + (37 * N3) / 96 - N4 / 360,
  N2 / 48 + N3 / 15 - (437 * N4) / 1440,
  (17 * N3) / 480 - (37 * N4) / 840,
  (4397 * N4) / 161_280,
]

const DELTA = [
  2 * N - (2 * N2) / 3 - 2 * N3 + (116 * N4) / 45,
  (7 * N2) / 3 - (8 * N3) / 5 - (227 * N4) / 45,
  (56 * N3) / 15 - (136 * N4) / 35,
  (4279 * N4) / 630,
]

const RAD = Math.PI / 180

const centralMeridianRad = (zone: number) => (zone * ZONE_WIDTH_DEG - 180 - ZONE_WIDTH_DEG / 2) * RAD

const sumOver = (coefficients: readonly number[], term: (harmonic: number) => number) =>
  coefficients.reduce((sum, coefficient, i) => sum + coefficient * term(2 * (i + 1)), 0)

export function utmZoneAt([lng, lat]: LngLat): UtmZone {
  return { zone: Math.floor((lng + 180) / ZONE_WIDTH_DEG) + 1, hemisphere: lat >= 0 ? 'N' : 'S' }
}

export function utmToLngLat({ easting, northing, zone, hemisphere }: UtmPoint): LngLat {
  const xi = (northing - (hemisphere === 'S' ? FALSE_NORTHING_SOUTH_M : 0)) / SCALED_RADIUS_M
  const eta = (easting - FALSE_EASTING_M) / SCALED_RADIUS_M
  const xiPrime = xi - sumOver(BETA, (k) => Math.sin(k * xi) * Math.cosh(k * eta))
  const etaPrime = eta - sumOver(BETA, (k) => Math.cos(k * xi) * Math.sinh(k * eta))
  const chi = Math.asin(Math.sin(xiPrime) / Math.cosh(etaPrime))
  const lat = chi + sumOver(DELTA, (k) => Math.sin(k * chi))
  const lng = centralMeridianRad(zone) + Math.atan2(Math.sinh(etaPrime), Math.cos(xiPrime))
  return [lng / RAD, lat / RAD]
}
