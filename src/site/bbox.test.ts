import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import { BboxParamSchema, bboxQuery, snapBbox, type Bbox } from './bbox'

const central: Bbox = [100.5671, 13.7632, 100.5709, 13.7668]

function issues(param: unknown): string {
  const result = BboxParamSchema.safeParse(param)
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

describe('BboxParamSchema', () => {
  it('parses and snaps a valid bbox', () => {
    expect(BboxParamSchema.parse('100.5671,13.7632,100.5709,13.7668')).toEqual([100.566, 13.762, 100.572, 13.768])
  })

  it('round-trips through bboxQuery', () => {
    const snapped = snapBbox(central)
    expect(BboxParamSchema.parse(bboxQuery(snapped))).toEqual(snapped)
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
