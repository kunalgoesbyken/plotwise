import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import type { Vec2 } from '@/geo/projection'
import { move, rigidMotion, starPolygon } from './arbitraries'
import { GeometryError } from './errors'
import { minAreaRect, type OrientedRect } from './obb'
import { signedArea } from './polygon'

const rectArea = (rect: OrientedRect) => rect.lengthM * rect.widthM

function holds(rect: OrientedRect, [x, y]: Vec2): boolean {
  const [dx, dy] = [x - rect.center[0], y - rect.center[1]]
  const along = dx * rect.axis[0] + dy * rect.axis[1]
  const across = -dx * rect.axis[1] + dy * rect.axis[0]
  return Math.abs(along) <= rect.lengthM / 2 + 1e-6 && Math.abs(across) <= rect.widthM / 2 + 1e-6
}

function axisAlignedArea(points: readonly Vec2[]): number {
  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)
  return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys))
}

describe('minAreaRect', () => {
  it('recovers a rotated 40 by 12 rectangle', () => {
    const rectangle: Vec2[] = [
      [0, 0],
      [40, 0],
      [40, 12],
      [0, 12],
    ]
    const rect = minAreaRect(move(rectangle, { angle: 0.6, dx: 100, dy: -50 }))
    expect(rect.lengthM).toBeCloseTo(40, 9)
    expect(rect.widthM).toBeCloseTo(12, 9)
    expect(Math.abs(rect.axis[0] * Math.cos(0.6) + rect.axis[1] * Math.sin(0.6))).toBeCloseTo(1, 9)
    const [cx, cy] = move([[20, 6]], { angle: 0.6, dx: 100, dy: -50 })[0]
    expect(rect.center[0]).toBeCloseTo(cx, 9)
    expect(rect.center[1]).toBeCloseTo(cy, 9)
  })

  it('boxes an L-shape and a right triangle', () => {
    const lShape: Vec2[] = [
      [0, 0],
      [20, 0],
      [20, 10],
      [10, 10],
      [10, 20],
      [0, 20],
    ]
    expect(rectArea(minAreaRect(lShape))).toBeCloseTo(400, 9)
    expect(
      rectArea(
        minAreaRect([
          [0, 0],
          [4, 0],
          [0, 3],
        ]),
      ),
    ).toBeCloseTo(12, 9)
  })

  it('handles collinear and single points', () => {
    const line = minAreaRect([
      [0, 0],
      [3, 4],
      [6, 8],
    ])
    expect(line.lengthM).toBeCloseTo(10, 9)
    expect(line.widthM).toBeCloseTo(0, 9)
    expect(minAreaRect([[2, 3]])).toMatchObject({ center: [2, 3], lengthM: 0, widthM: 0 })
  })

  it('rejects an empty point set', () => {
    expect(() => minAreaRect([])).toThrow(GeometryError)
  })

  it('holds every point, beats the axis-aligned box and ignores rigid motion', () => {
    fc.assert(
      fc.property(starPolygon(), rigidMotion, (points, motion) => {
        const rect = minAreaRect(points)
        expect(rect.lengthM).toBeGreaterThanOrEqual(rect.widthM)
        expect(points.every((p) => holds(rect, p))).toBe(true)
        expect(rectArea(rect)).toBeLessThanOrEqual(axisAlignedArea(points) + 1e-6)
        expect(signedArea(rect.corners)).toBeCloseTo(rectArea(rect), 6)
        const moved = minAreaRect(move(points, motion))
        expect(Math.abs(rectArea(moved) - rectArea(rect))).toBeLessThan(1e-6 * rectArea(rect) + 1e-9)
      }),
    )
  })
})
