import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import type { Vec2 } from '@/geo/projection'
import { move, rigidMotion, starPolygon } from './arbitraries'
import { GeometryError, type GeometryErrorReason } from './errors'
import { centroid, contains, edgeLengths, normalizeRing, polygonArea, signedArea } from './polygon'

const square: Vec2[] = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
]

const lShape: Vec2[] = [
  [0, 0],
  [20, 0],
  [20, 10],
  [10, 10],
  [10, 20],
  [0, 20],
]

function reasonOf(points: Vec2[]): GeometryErrorReason | undefined {
  try {
    normalizeRing(points)
    return undefined
  } catch (error) {
    if (error instanceof GeometryError) return error.reason
    throw error
  }
}

describe('signedArea', () => {
  it('is positive for counter-clockwise rings and negative for clockwise ones', () => {
    expect(signedArea(square)).toBe(100)
    expect(signedArea([...square].reverse())).toBe(-100)
  })

  it('measures an L-shape', () => {
    expect(signedArea(lShape)).toBe(300)
  })
})

describe('polygonArea', () => {
  it('subtracts holes from the outer ring', () => {
    const hole: Vec2[] = [
      [2, 2],
      [2, 4],
      [4, 4],
      [4, 2],
    ]
    expect(polygonArea({ outer: square, holes: [hole] })).toBe(96)
  })
})

describe('edgeLengths', () => {
  it('includes the closing edge', () => {
    expect(
      edgeLengths([
        [0, 0],
        [3, 0],
        [3, 4],
      ]),
    ).toEqual([3, 4, 5])
  })
})

describe('centroid', () => {
  it('finds the centre of a square and the area centroid of an L-shape', () => {
    expect(centroid(square)).toEqual([5, 5])
    const [x, y] = centroid(lShape)
    expect(x).toBeCloseTo(25 / 3, 9)
    expect(y).toBeCloseTo(25 / 3, 9)
  })

  it('moves with the ring', () => {
    fc.assert(
      fc.property(starPolygon(), rigidMotion, (points, motion) => {
        const [moved] = move([centroid(points)], motion)
        const [x, y] = centroid(move(points, motion))
        expect(Math.hypot(x - moved[0], y - moved[1])).toBeLessThan(1e-6)
      }),
    )
  })
})

describe('contains', () => {
  it('separates inside, outside and boundary points', () => {
    expect(contains(lShape, [5, 5])).toBe(true)
    expect(contains(lShape, [15, 15])).toBe(false)
    expect(contains(lShape, [-1, 5])).toBe(false)
    expect(contains(lShape, [10, 15])).toBe(true)
    expect(contains(lShape, [0, 0])).toBe(true)
  })
})

describe('normalizeRing', () => {
  it('turns a clockwise ring counter-clockwise and keeps the first vertex', () => {
    expect([...normalizeRing([...square].reverse())]).toEqual([
      [0, 10],
      [0, 0],
      [10, 0],
      [10, 10],
    ])
  })

  it('drops duplicate, closing and collinear points', () => {
    const noisy: Vec2[] = [[0, 0], [5, 0], [10, 0], [10, 0], [10, 10], [0, 10], [0, 5], [0, 0]]
    expect([...normalizeRing(noisy)]).toEqual(square)
  })

  it('drops a zero-width spike', () => {
    const spiked: Vec2[] = [[0, 0], [10, 0], [10, 10], [10, 25], [10, 10], [0, 10]]
    expect([...normalizeRing(spiked)]).toEqual(square)
  })

  it('keeps a short but real chamfer edge', () => {
    const chamfered: Vec2[] = [[0, 0], [20, 0], [20, 29.995], [19.995, 30], [0, 30]]
    expect(normalizeRing(chamfered)).toHaveLength(5)
  })

  it('rejects a bow-tie and a figure-eight that touches itself at a vertex', () => {
    expect(reasonOf([[0, 0], [10, 10], [10, 0], [0, 10]])).toBe('self-intersecting')
    expect(reasonOf([[0, 0], [10, 0], [5, 5], [10, 10], [0, 10], [5, 5]])).toBe('self-intersecting')
  })

  it('rejects an edge that runs back along another edge', () => {
    expect(reasonOf([[0, 0], [10, 0], [10, 10], [5, 0.0005], [0, 10]])).toBe('self-intersecting')
  })

  it('rejects rings that have no area', () => {
    expect(reasonOf([[0, 0], [10, 0]])).toBe('degenerate')
    expect(reasonOf([[0, 0], [5, 0], [10, 0]])).toBe('degenerate')
    expect(reasonOf([[1, 1], [1, 1], [1, 1], [1, 1.0001]])).toBe('degenerate')
  })

  it('rejects non-finite coordinates', () => {
    expect(reasonOf([[0, 0], [10, Number.NaN], [10, 10]])).toBe('non-finite')
    expect(reasonOf([[0, 0], [Infinity, 0], [10, 10]])).toBe('non-finite')
  })

  it('rejects coordinates too far away to be a local plot', () => {
    expect(reasonOf([[0, 0], [1e9, 0], [0, 10]])).toBe('out-of-range')
  })

  it('never fails with anything but a GeometryError', () => {
    const anyCoordinate = fc.oneof(fc.double(), fc.integer({ min: -3, max: 3 }))
    fc.assert(
      fc.property(fc.array(fc.tuple(anyCoordinate, anyCoordinate), { maxLength: 12 }), (points) => {
        reasonOf(points)
      }),
      { numRuns: 2000 },
    )
  })

  it('accepts every star-shaped polygon, keeps its area and is idempotent', () => {
    fc.assert(
      fc.property(starPolygon(), (points) => {
        const ring = normalizeRing(points)
        expect(signedArea(ring)).toBeGreaterThan(0)
        expect(Math.abs(signedArea(ring) - Math.abs(signedArea(points)))).toBeLessThan(0.1)
        expect(normalizeRing(ring)).toEqual(ring)
      }),
    )
  })
})
