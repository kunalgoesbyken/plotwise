import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import type { Vec2 } from '@/geo/projection'
import { convexPolygon, irregularPlot, move, rigidMotion, setbackSeeds, starPolygon } from './arbitraries'
import { difference } from './clip'
import { GeometryError } from './errors'
import { contains, normalizeRing, signedArea, totalArea, type Polygon, type Ring } from './polygon'
import { setbackEnvelope } from './setback'

const ring = (points: Vec2[]) => normalizeRing(points)
const asPolygon = (outline: Ring): Polygon => ({ outer: outline, holes: [] })
const vertices = (polygons: readonly Polygon[]) => polygons.flatMap((p) => [...p.outer, ...p.holes.flat()])
const outside = (inner: readonly Polygon[], outer: readonly Polygon[]) => totalArea(difference(inner, outer))

function distanceToSegment([px, py]: Vec2, [ax, ay]: Vec2, [bx, by]: Vec2): number {
  const [dx, dy] = [bx - ax, by - ay]
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
  return Math.hypot(px - ax - t * dx, py - ay - t * dy)
}

function clearance(plot: Ring, setbacks: readonly number[], polygons: readonly Polygon[]): number {
  return Math.min(
    Infinity,
    ...vertices(polygons).flatMap((v) =>
      plot.map((a, i) => distanceToSegment(v, a, plot[(i + 1) % plot.length]) - setbacks[i]),
    ),
  )
}

function halfPlaneEnvelopeArea(plot: Ring, setbacks: readonly number[]): number {
  const clipped = plot.reduce<Vec2[]>((poly, [ax, ay], i) => {
    const [bx, by] = plot[(i + 1) % plot.length]
    const length = Math.hypot(bx - ax, by - ay)
    const [nx, ny] = [-(by - ay) / length, (bx - ax) / length]
    const depth = ([x, y]: Vec2) => (x - ax) * nx + (y - ay) * ny - setbacks[i]
    return poly.flatMap((p, j) => {
      const q = poly[(j + 1) % poly.length]
      const [dp, dq] = [depth(p), depth(q)]
      const crossing: Vec2 = [p[0] + (q[0] - p[0]) * (dp / (dp - dq)), p[1] + (q[1] - p[1]) * (dp / (dp - dq))]
      if (dp >= 0) return dq >= 0 ? [p] : [p, crossing]
      return dq >= 0 ? [crossing] : []
    })
  }, [...plot])
  return clipped.length < 3 ? 0 : signedArea(clipped)
}

const rectangle = ring([
  [0, 0],
  [20, 0],
  [20, 30],
  [0, 30],
])

const lShape = ring([
  [0, 0],
  [20, 0],
  [20, 10],
  [10, 10],
  [10, 20],
  [0, 20],
])

const trapezoid = ring([
  [0, 0],
  [100, 0],
  [90, 8],
  [10, 8],
])

describe('setbackEnvelope', () => {
  it('moves each edge of a rectangle in by its own distance', () => {
    const envelope = setbackEnvelope(rectangle, [3, 1.5, 1.5, 1.5])
    expect(envelope).toHaveLength(1)
    expect(totalArea(envelope)).toBeCloseTo(433.5, 6)
    const corners: Vec2[] = [
      [1.5, 3],
      [18.5, 3],
      [18.5, 28.5],
      [1.5, 28.5],
    ]
    expect(envelope[0].outer).toHaveLength(4)
    expect(envelope[0].outer).toEqual(expect.arrayContaining(corners))
  })

  it('rounds the inside of a concave corner so every point keeps its distance', () => {
    const envelope = setbackEnvelope(lShape, [2, 2, 2, 2, 2, 2])
    expect(totalArea(envelope)).toBeLessThanOrEqual(160 - Math.PI)
    expect(totalArea(envelope)).toBeGreaterThan(160 - Math.PI - 0.02)
  })

  it('shrinks a triangle towards its incentre', () => {
    const triangle = ring([
      [0, 0],
      [40, 0],
      [0, 30],
    ])
    expect(totalArea(setbackEnvelope(triangle, [2, 2, 2]))).toBeCloseTo(600 * 0.8 ** 2, 6)
  })

  it('handles a very acute triangle', () => {
    const sliver = ring([
      [0, 0],
      [100, 0],
      [100, 5],
    ])
    const inradius = 250 / ((100 + 5 + Math.hypot(100, 5)) / 2)
    const expected = 250 * ((inradius - 1) / inradius) ** 2
    expect(totalArea(setbackEnvelope(sliver, [1, 1, 1]))).toBeCloseTo(expected, 3)
  })

  it('matches the exact inward offset of a long thin trapezoid', () => {
    expect(totalArea(setbackEnvelope(trapezoid, [2, 2, 2, 2]))).toBeCloseTo(halfPlaneEnvelopeArea(trapezoid, [2, 2, 2, 2]), 3)
  })

  it('measures distance to the edge itself, so a deep setback does not run past an obtuse corner', () => {
    const setbacks = [1, 1, 3, 1]
    const envelope = setbackEnvelope(trapezoid, setbacks)
    expect(totalArea(envelope)).toBeGreaterThan(halfPlaneEnvelopeArea(trapezoid, setbacks) + 0.1)
    expect(clearance(trapezoid, setbacks, envelope)).toBeGreaterThan(-1e-3)
  })

  it('vanishes when opposite setbacks overlap or exceed the plot', () => {
    expect(setbackEnvelope(trapezoid, [5, 1, 5, 1])).toEqual([])
    expect(setbackEnvelope(rectangle, [50, 50, 50, 50])).toEqual([])
  })

  it('splits a dumbbell plot into two pieces when the neck closes', () => {
    const dumbbell = ring([
      [0, 0],
      [20, 0],
      [20, 8],
      [30, 8],
      [30, 0],
      [50, 0],
      [50, 20],
      [30, 20],
      [30, 12],
      [20, 12],
      [20, 20],
      [0, 20],
    ])
    const envelope = setbackEnvelope(dumbbell, Array(12).fill(3))
    const bulgeIntoNeck = 2 * (6 - (Math.sqrt(5) + 4.5 * Math.asin(2 / 3)))
    const expected = 2 * (14 * 14 + bulgeIntoNeck)
    expect(envelope).toHaveLength(2)
    expect(totalArea(envelope)).toBeLessThanOrEqual(expected)
    expect(totalArea(envelope)).toBeGreaterThan(expected - 0.02)
  })

  it('ignores a near-zero chamfer edge that its neighbours already cover', () => {
    const chamfered = ring([
      [0, 0],
      [20, 0],
      [20, 29.995],
      [19.995, 30],
      [0, 30],
    ])
    expect(totalArea(setbackEnvelope(chamfered, [3, 1.5, 1.5, 1.5, 1.5]))).toBeCloseTo(433.5, 6)
  })

  it('returns the plot itself for zero setbacks', () => {
    expect(totalArea(setbackEnvelope(lShape, [0, 0, 0, 0, 0, 0]))).toBeCloseTo(300, 6)
  })

  it('keeps a 30-vertex irregular plot inside its outline and clear of every edge', () => {
    const plot = ring(irregularPlot(30))
    const setbacks = plot.map((_, i) => 1 + (i % 5))
    const envelope = setbackEnvelope(plot, setbacks)
    expect(envelope.length).toBeGreaterThan(0)
    expect(totalArea(envelope)).toBeLessThan(signedArea(plot))
    expect(outside(envelope, [asPolygon(plot)])).toBeLessThan(1e-3)
    expect(clearance(plot, setbacks, envelope)).toBeGreaterThan(-1e-3)
  })

  it('rejects a setback list that does not match the edges', () => {
    expect(() => setbackEnvelope(rectangle, [1, 1, 1])).toThrow(GeometryError)
    expect(() => setbackEnvelope(rectangle, [1, -1, 1, 1])).toThrow(GeometryError)
    expect(() => setbackEnvelope(rectangle, [1, Number.NaN, 1, 1])).toThrow(GeometryError)
  })

  it('treats an absurdly large setback like any setback deeper than the plot', () => {
    expect(setbackEnvelope(rectangle, [1e12, 1, 1, 1])).toEqual([])
  })

  it('only ever throws a GeometryError, whatever the outline and setbacks', () => {
    const anyCoordinate = fc.oneof(fc.double({ noNaN: true }), fc.integer({ min: -30, max: 30 }))
    const anySetback = fc.oneof(fc.double(), fc.double({ min: 0, max: 50, noNaN: true }))
    fc.assert(
      fc.property(
        fc.array(fc.tuple(anyCoordinate, anyCoordinate), { minLength: 3, maxLength: 10 }),
        fc.array(anySetback, { minLength: 10, maxLength: 10 }),
        (points, seeds) => {
          try {
            const plot = ring(points)
            setbackEnvelope(plot, seeds.slice(0, plot.length))
          } catch (error) {
            expect(error).toBeInstanceOf(GeometryError)
          }
        },
      ),
      { numRuns: 1000 },
    )
  })
})

const plotWithSetbacks = (max = 15) =>
  fc.tuple(starPolygon(), setbackSeeds(max)).map(([points, seeds]) => {
    const plot = ring(points)
    return { plot, setbacks: seeds.slice(0, plot.length) }
  })

describe('setbackEnvelope properties', () => {
  it('stays inside the plot and keeps every setback', () => {
    fc.assert(
      fc.property(plotWithSetbacks(), ({ plot, setbacks }) => {
        const envelope = setbackEnvelope(plot, setbacks)
        expect(vertices(envelope).every((v) => contains(plot, v))).toBe(true)
        expect(outside(envelope, [asPolygon(plot)])).toBeLessThan(1e-3)
        expect(clearance(plot, setbacks, envelope)).toBeGreaterThan(-1e-3)
      }),
      { numRuns: 200 },
    )
  })

  it('never grows when any setback grows', () => {
    fc.assert(
      fc.property(
        plotWithSetbacks(),
        fc.nat(),
        fc.double({ min: 0, max: 5, noNaN: true }),
        ({ plot, setbacks }, pick, extra) => {
          const grown = setbacks.map((d, i) => (i === pick % setbacks.length ? d + extra : d))
          const before = setbackEnvelope(plot, setbacks)
          const after = setbackEnvelope(plot, grown)
          expect(totalArea(after)).toBeLessThanOrEqual(totalArea(before) + 1e-3)
          expect(outside(after, before)).toBeLessThan(1e-3)
        },
      ),
      { numRuns: 200 },
    )
  })

  it('gives the plot back for zero setbacks', () => {
    fc.assert(
      fc.property(starPolygon(), (points) => {
        const plot = ring(points)
        const envelope = setbackEnvelope(plot, Array(plot.length).fill(0))
        expect(Math.abs(totalArea(envelope) - signedArea(plot))).toBeLessThan(1e-3)
      }),
    )
  })

  it('does not depend on where the plot is or which way it faces', () => {
    fc.assert(
      fc.property(plotWithSetbacks(), rigidMotion, ({ plot, setbacks }, motion) => {
        const movedPlot = ring(move(plot, motion))
        expect(movedPlot).toHaveLength(plot.length)
        const original = setbackEnvelope(plot, setbacks).map((p) => ({ outer: move(p.outer, motion), holes: [] }))
        const moved = setbackEnvelope(movedPlot, setbacks)
        expect(Math.abs(totalArea(moved) - totalArea(original))).toBeLessThan(1e-2)
        expect(outside(moved, original) + outside(original, moved)).toBeLessThan(1e-2)
      }),
      { numRuns: 200 },
    )
  })

  it('equals the exact inward offset of a convex plot under a uniform setback', () => {
    fc.assert(
      fc.property(convexPolygon(), fc.double({ min: 0, max: 30, noNaN: true }), (points, setback) => {
        const plot = ring(points)
        const setbacks = Array(plot.length).fill(setback)
        expect(Math.abs(totalArea(setbackEnvelope(plot, setbacks)) - halfPlaneEnvelopeArea(plot, setbacks))).toBeLessThan(1e-2)
      }),
      { numRuns: 300 },
    )
  })

  it('never loses the half-plane intersection of a convex plot', () => {
    fc.assert(
      fc.property(convexPolygon(), setbackSeeds(10), (points, seeds) => {
        const plot = ring(points)
        const setbacks = seeds.slice(0, plot.length)
        expect(totalArea(setbackEnvelope(plot, setbacks))).toBeGreaterThan(halfPlaneEnvelopeArea(plot, setbacks) - 1e-2)
      }),
      { numRuns: 300 },
    )
  })

  it('never throws on random plots, even with setbacks larger than the plot', () => {
    fc.assert(
      fc.property(plotWithSetbacks(80), ({ plot, setbacks }) => {
        expect(totalArea(setbackEnvelope(plot, setbacks))).toBeLessThanOrEqual(signedArea(plot) + 1e-3)
      }),
      { numRuns: 200 },
    )
  })
})
