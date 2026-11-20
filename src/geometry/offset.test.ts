import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import type { Vec2 } from '@/geo/projection'
import { convexPolygon } from './arbitraries'
import { GeometryError } from './errors'
import { offsetEdges } from './offset'
import { edgeLengths, normalizeRing, polygonArea, type Ring } from './polygon'

const area = (ring: Ring) => polygonArea({ outer: ring, holes: [] })

function insideBy(ring: Ring, edge: number, [x, y]: Vec2): number {
  const [[ax, ay], [bx, by]] = [ring[edge], ring[(edge + 1) % ring.length]]
  return ((bx - ax) * (y - ay) - (by - ay) * (x - ax)) / Math.hypot(bx - ax, by - ay)
}

const square: Ring = normalizeRing([
  [0, 0],
  [40, 0],
  [40, 50],
  [0, 50],
])

describe('offsetEdges', () => {
  it('returns the same outline when no edge moves', () => {
    expect(area(offsetEdges(square, [0, 0, 0, 0]))).toBeCloseTo(area(square), 9)
  })

  it('moves one edge inward by its depth', () => {
    fc.assert(
      fc.property(fc.double({ min: 0.1, max: 45, noNaN: true }), (depthM) => {
        const depths = square.map((_, i) => (i === 0 ? depthM : 0))
        expect(area(offsetEdges(square, depths))).toBeCloseTo(area(square) - depthM * edgeLengths(square)[0], 6)
      }),
    )
  })

  it('puts each edge on the line its depth inside the old one, and never adds area', () => {
    fc.assert(
      fc.property(convexPolygon(), fc.double({ min: 0, max: 1, noNaN: true }), (points, depthM) => {
        const ring = normalizeRing(points)
        const depths = ring.map((_, i) => (i % 2 === 0 ? depthM : 0))
        let offset: Ring
        try {
          offset = offsetEdges(ring, depths)
        } catch (error) {
          expect(error).toBeInstanceOf(GeometryError)
          return
        }
        expect(area(offset)).toBeLessThanOrEqual(area(ring) + 1e-6)
        offset.forEach((_, i) => {
          for (const corner of [offset[i], offset[(i + 1) % offset.length]]) {
            expect(insideBy(ring, i, corner)).toBeCloseTo(depths[i], 6)
          }
        })
      }),
    )
  })

  it('refuses strips deeper than the plot and a depth list of the wrong length', () => {
    expect(() => offsetEdges(square, [30, 0, 30, 0])).toThrow(GeometryError)
    expect(() => offsetEdges(square, [1, 0, 0])).toThrow(GeometryError)
    expect(() => offsetEdges(square, [-1, 0, 0, 0])).toThrow(GeometryError)
  })
})
