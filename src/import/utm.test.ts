import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import type { LngLat } from '@/geo/projection'
import { utmToLngLat, utmZoneAt, UtmZoneSchema, type UtmPoint } from './utm'

const A = 6_378_137
const F = 1 / 298.257_223_563
const N = F / (2 - F)
const ALPHA = [
  N / 2 - (2 * N ** 2) / 3 + (5 * N ** 3) / 16 + (41 * N ** 4) / 180,
  (13 * N ** 2) / 48 - (3 * N ** 3) / 5 + (557 * N ** 4) / 1440,
  (61 * N ** 3) / 240 - (103 * N ** 4) / 140,
  (49_561 * N ** 4) / 161_280,
]
const RAD = Math.PI / 180

function lngLatToUtm([lng, lat]: LngLat, zone: number): UtmPoint {
  const lambda = lng * RAD - (zone * 6 - 183) * RAD
  const phi = lat * RAD
  const e = Math.sqrt(F * (2 - F))
  const t = Math.sinh(Math.atanh(Math.sin(phi)) - e * Math.atanh(e * Math.sin(phi)))
  const xi = Math.atan2(t, Math.cos(lambda))
  const eta = Math.atanh(Math.sin(lambda) / Math.hypot(1, t))
  const radius = (A / (1 + N)) * (1 + N ** 2 / 4 + N ** 4 / 64) * 0.9996
  const k = [2, 4, 6, 8]
  const easting = 500_000 + radius * (eta + ALPHA.reduce((s, a, i) => s + a * Math.cos(k[i] * xi) * Math.sinh(k[i] * eta), 0))
  const northing = radius * (xi + ALPHA.reduce((s, a, i) => s + a * Math.sin(k[i] * xi) * Math.cosh(k[i] * eta), 0))
  return lat >= 0 ? { zone, hemisphere: 'N', easting, northing } : { zone, hemisphere: 'S', easting, northing: northing + 10_000_000 }
}

const closeTo = (actual: LngLat, expected: LngLat, degrees: number) => {
  expect(Math.abs(actual[0] - expected[0])).toBeLessThan(degrees)
  expect(Math.abs(actual[1] - expected[1])).toBeLessThan(degrees)
}

describe('utmToLngLat', () => {
  it('puts the central meridian on the equator at the false easting and zero northing', () => {
    closeTo(utmToLngLat({ zone: 47, hemisphere: 'N', easting: 500_000, northing: 0 }), [99, 0], 1e-9)
  })

  it('reads the Eiffel Tower in zone 31 north to within a metre or two', () => {
    closeTo(utmToLngLat({ zone: 31, hemisphere: 'N', easting: 448_251.8, northing: 5_411_932.7 }), [2.2945, 48.858222], 3e-5)
  })

  it('reads a Bangkok point in zone 47 north the same as the independent forward formula', () => {
    const point = lngLatToUtm([100.5018, 13.7563], 47)
    expect(point.easting).toBeGreaterThan(660_000)
    expect(point.easting).toBeLessThan(670_000)
    expect(point.northing).toBeGreaterThan(1_520_000)
    expect(point.northing).toBeLessThan(1_530_000)
    closeTo(utmToLngLat(point), [100.5018, 13.7563], 1e-9)
  })

  it('counts northings from the false northing in the southern hemisphere', () => {
    const [, lat] = utmToLngLat({ zone: 56, hemisphere: 'S', easting: 500_000, northing: 6_000_000 })
    expect(lat).toBeLessThan(-33)
    expect(lat).toBeGreaterThan(-40)
  })

  it('inverts the forward projection anywhere in a zone', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 60 }),
        fc.double({ min: -3, max: 3, noNaN: true }),
        fc.double({ min: -80, max: 84, noNaN: true }),
        (zone, offset, lat) => {
          const lng = zone * 6 - 183 + offset
          closeTo(utmToLngLat(lngLatToUtm([lng, lat], zone)), [lng, lat], 1e-8)
        },
      ),
    )
  })
})

describe('utmZoneAt', () => {
  it('finds the zone and hemisphere a point lies in', () => {
    expect(utmZoneAt([100.5268, 13.7236])).toEqual({ zone: 47, hemisphere: 'N' })
    expect(utmZoneAt([151.2, -33.9])).toEqual({ zone: 56, hemisphere: 'S' })
    expect(utmZoneAt([-179.9, 10])).toEqual({ zone: 1, hemisphere: 'N' })
  })
})

describe('UtmZoneSchema', () => {
  it('accepts zones 1 to 60 and rejects the rest', () => {
    expect(UtmZoneSchema.safeParse({ zone: 47, hemisphere: 'N' }).success).toBe(true)
    expect(UtmZoneSchema.safeParse({ zone: 0, hemisphere: 'N' }).success).toBe(false)
    expect(UtmZoneSchema.safeParse({ zone: 61, hemisphere: 'N' }).success).toBe(false)
    expect(UtmZoneSchema.safeParse({ zone: 4.5, hemisphere: 'N' }).success).toBe(false)
    expect(UtmZoneSchema.safeParse({ zone: 47, hemisphere: 'X' }).success).toBe(false)
  })
})
