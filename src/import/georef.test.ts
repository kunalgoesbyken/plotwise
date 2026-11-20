import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import { localFrame, type LngLat } from '@/geo/projection'
import { locate } from './georef'
import { shapeOf } from './shape'
import type { Pair } from './types'
import { utmToLngLat } from './utm'

describe('locate', () => {
  it('reads degrees in either order', () => {
    expect(locate([[100.5, 13.7]], { kind: 'degrees', order: 'lng-lat' })).toEqual([[100.5, 13.7]])
    expect(locate([[13.7, 100.5]], { kind: 'degrees', order: 'lat-lng' })).toEqual([[100.5, 13.7]])
  })

  it('reads UTM easting and northing in either order and scales them from the drawing unit', () => {
    const utm = { kind: 'utm', zone: 47, hemisphere: 'N', unitM: 1 } as const
    const expected = utmToLngLat({ zone: 47, hemisphere: 'N', easting: 670_304.52, northing: 1_523_806.26 })
    expect(locate([[670_304.52, 1_523_806.26]], { ...utm, order: 'east-north' })).toEqual([expected])
    expect(locate([[1_523_806.26, 670_304.52]], { ...utm, order: 'north-east' })).toEqual([expected])
    expect(locate([[670_304_520, 1_523_806_260]], { ...utm, order: 'east-north', unitM: 0.001 })[0][0]).toBeCloseTo(expected[0], 9)
  })

  it('places the first point on the reference and keeps distances in metres', () => {
    const at: LngLat = [100.5, 13.7]
    const [first, second] = locate(
      [
        [5000, 7000],
        [5000 + 30_000, 7000 + 40_000],
      ],
      { kind: 'reference', at, unitM: 0.001 },
    )
    expect(first).toEqual(at)
    const [dx, dy] = localFrame(at).toLocal(second)
    expect(dx).toBeCloseTo(30, 6)
    expect(dy).toBeCloseTo(40, 6)
  })

  it('returns nothing for nothing', () => {
    expect(locate([], { kind: 'reference', at: [100, 13], unitM: 1 })).toEqual([])
  })

  it('keeps every distance of the drawing whatever the unit', () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.double({ min: -1e5, max: 1e5, noNaN: true }), fc.double({ min: -1e5, max: 1e5, noNaN: true })), { minLength: 2, maxLength: 6 }),
        fc.constantFrom(0.001, 0.01, 0.3048, 1),
        (points: Pair[], unitM) => {
          const at: LngLat = [100.5, 13.7]
          const frame = localFrame(at)
          const located = locate(points, { kind: 'reference', at, unitM }).map(frame.toLocal)
          const [x0, y0] = points[0]
          points.forEach(([x, y], i) => {
            expect(located[i][0]).toBeCloseTo((x - x0) * unitM, 5)
            expect(located[i][1]).toBeCloseTo((y - y0) * unitM, 5)
          })
        },
      ),
    )
  })
})

describe('shapeOf', () => {
  const square: Pair[] = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ]

  it('drops a repeated first point and marks the shape closed', () => {
    expect(shapeOf('plot', [...square, square[0]], false)).toEqual({ name: 'plot', points: square, closed: true })
  })

  it('keeps the declared closure when the first point is not repeated', () => {
    expect(shapeOf(null, square, true)).toEqual({ name: null, points: square, closed: true })
    expect(shapeOf(null, square, false)).toEqual({ name: null, points: square, closed: false })
  })
})
