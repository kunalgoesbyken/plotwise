import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import { localFrame } from '@/geo/projection'
import { NEAREST_ROAD_MAX_GAP_M, SITE_MARGIN_M } from './assumptions'
import { REGIONS } from '@/region/regions'
import { bboxParamSchema, bboxQuery, expandBbox, plotSiteBbox, snapBbox, type Bbox } from './bbox'

const central: Bbox = [100.5671, 13.7632, 100.5709, 13.7668]

function issues(param: unknown): string {
  const result = bboxParamSchema(REGIONS.bkk).safeParse(param)
  return result.success ? '' : result.error.issues.map((i) => i.message).join(' | ')
}

describe('snapBbox', () => {
  it('snaps outward so the original box is always covered', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 98, max: 104, noNaN: true }),
        fc.double({ min: 6, max: 20, noNaN: true }),
        fc.double({ min: 0.0001, max: 0.01, noNaN: true }),
        (lng, lat, size) => {
          const [minLng, minLat, maxLng, maxLat] = snapBbox([lng, lat, lng + size, lat + size])
          expect(minLng).toBeLessThanOrEqual(lng)
          expect(minLat).toBeLessThanOrEqual(lat)
          expect(maxLng).toBeGreaterThanOrEqual(lng + size)
          expect(maxLat).toBeGreaterThanOrEqual(lat + size)
        },
      ),
    )
  })

  it('is idempotent', () => {
    const once = snapBbox(central)
    expect(snapBbox(once)).toEqual(once)
  })

  it('gives nearby boxes the same cache key', () => {
    expect(bboxQuery(snapBbox([100.5671, 13.7632, 100.5709, 13.7668]))).toBe(
      bboxQuery(snapBbox([100.5673, 13.7634, 100.5707, 13.7666])),
    )
  })

  it('lands on clean decimal values', () => {
    expect(snapBbox(central)).toEqual([100.566, 13.762, 100.572, 13.768])
  })
})

describe('bboxParamSchema', () => {
  it('parses and snaps a valid bbox', () => {
    expect(bboxParamSchema(REGIONS.bkk).parse('100.5671,13.7632,100.5709,13.7668')).toEqual([100.566, 13.762, 100.572, 13.768])
  })

  it('round-trips through bboxQuery', () => {
    const snapped = snapBbox(central)
    expect(bboxParamSchema(REGIONS.bkk).parse(bboxQuery(snapped))).toEqual(snapped)
  })

  it('rejects a missing parameter', () => {
    expect(issues(null)).toContain('bbox is required')
  })

  it.each(['1,2,3', 'a,b,c,d', '100.5,13.7,,13.8', '100.5,13.7,100.6,13.8,1', '100.5,13.7,Infinity,13.8'])(
    'rejects malformed input %p',
    (param) => {
      expect(issues(param)).toContain('four numbers')
    },
  )

  it('rejects an inverted box', () => {
    expect(issues('100.58,13.77,100.57,13.76')).toContain('minimum')
  })

  it('rejects boxes outside Thailand', () => {
    expect(issues('77.58,12.97,77.59,12.98')).toContain('Thailand')
    expect(issues('100.5,3.0,100.51,3.01')).toContain('Thailand')
  })

  it('rejects boxes wider than the limit', () => {
    expect(issues('100.50,13.70,100.53,13.71')).toContain('too large')
    expect(issues('100.50,13.70,100.51,13.73')).toContain('too large')
  })

  it('accepts a box of about 1.3 km', () => {
    expect(issues('100.50,13.70,100.51,13.71')).toBe('')
  })
})

describe('expandBbox', () => {
  it('grows the box by the margin on every side', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 2000, noNaN: true }), (marginM) => {
        const frame = localFrame([central[0], central[1]])
        const [west, south] = frame.toLocal([central[0], central[1]])
        const [east, north] = frame.toLocal([central[2], central[3]])
        const [minLng, minLat, maxLng, maxLat] = expandBbox(central, marginM)
        const grown = [...frame.toLocal([minLng, minLat]), ...frame.toLocal([maxLng, maxLat])]
        expect(grown[0]).toBeCloseTo(west - marginM, 3)
        expect(grown[1]).toBeCloseTo(south - marginM, 3)
        expect(grown[2]).toBeCloseTo(east + marginM, 3)
        expect(grown[3]).toBeCloseTo(north + marginM, 3)
      }),
    )
  })
})

describe('plotSiteBbox', () => {
  it('covers the plot with the site margin on every side', () => {
    const frame = localFrame([100.53, 13.724])
    const ring = [frame.toLngLat([0, 0]), frame.toLngLat([40, 0]), frame.toLngLat([40, 30])]
    const [minLng, minLat, maxLng, maxLat] = plotSiteBbox(ring)
    const [west, south] = frame.toLocal([minLng, minLat])
    const [east, north] = frame.toLocal([maxLng, maxLat])
    const margin = SITE_MARGIN_M.value
    expect([west, south, east, north].map((v) => Math.round(v * 1000) / 1000)).toEqual([-margin, -margin, 40 + margin, 30 + margin])
  })

  it('leaves room for a road across the widest allowed gap', () => {
    expect(SITE_MARGIN_M.value).toBeGreaterThanOrEqual(2 * NEAREST_ROAD_MAX_GAP_M.value)
  })
})
