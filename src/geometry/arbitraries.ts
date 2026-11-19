import fc from 'fast-check'
import type { Vec2 } from '@/geo/projection'

const TAU = 2 * Math.PI

function cumulativeAngles(gaps: readonly number[], phase: number): number[] {
  const total = gaps.reduce((sum, gap) => sum + gap, 0)
  let running = 0
  return gaps.map((gap) => {
    running += gap
    return phase + (running / total) * TAU
  })
}

const coordinate = fc.double({ min: -500, max: 500, noNaN: true })

export const starPolygon = (maxVertices = 30): fc.Arbitrary<Vec2[]> =>
  fc
    .integer({ min: 3, max: maxVertices })
    .chain((n) =>
      fc.record({
        gaps: fc.array(fc.double({ min: 1, max: 2, noNaN: true }), { minLength: n, maxLength: n }),
        radii: fc.array(fc.double({ min: 5, max: 60, noNaN: true }), { minLength: n, maxLength: n }),
        phase: fc.double({ min: 0, max: TAU, noNaN: true }),
        cx: coordinate,
        cy: coordinate,
      }),
    )
    .map(({ gaps, radii, phase, cx, cy }) =>
      cumulativeAngles(gaps, phase).map((angle, i): Vec2 => [cx + radii[i] * Math.cos(angle), cy + radii[i] * Math.sin(angle)]),
    )

export const convexPolygon = (maxVertices = 12): fc.Arbitrary<Vec2[]> =>
  fc
    .integer({ min: 3, max: maxVertices })
    .chain((n) =>
      fc.record({
        gaps: fc.array(fc.double({ min: 1, max: 2, noNaN: true }), { minLength: n, maxLength: n }),
        a: fc.double({ min: 5, max: 80, noNaN: true }),
        b: fc.double({ min: 5, max: 80, noNaN: true }),
        tilt: fc.double({ min: 0, max: Math.PI, noNaN: true }),
        cx: coordinate,
        cy: coordinate,
      }),
    )
    .map(({ gaps, a, b, tilt, cx, cy }) =>
      cumulativeAngles(gaps, 0).map((t): Vec2 => {
        const [x, y] = [a * Math.cos(t), b * Math.sin(t)]
        return [cx + x * Math.cos(tilt) - y * Math.sin(tilt), cy + x * Math.sin(tilt) + y * Math.cos(tilt)]
      }),
    )

export const setbackSeeds = (max = 15): fc.Arbitrary<number[]> =>
  fc.array(fc.double({ min: 0, max, noNaN: true }), { minLength: 30, maxLength: 30 })

export const rigidMotion = fc.record({
  angle: fc.double({ min: 0, max: TAU, noNaN: true }),
  dx: fc.double({ min: -1000, max: 1000, noNaN: true }),
  dy: fc.double({ min: -1000, max: 1000, noNaN: true }),
})

export type RigidMotion = { angle: number; dx: number; dy: number }

export function move(points: readonly Vec2[], { angle, dx, dy }: RigidMotion): Vec2[] {
  const [c, s] = [Math.cos(angle), Math.sin(angle)]
  return points.map(([x, y]) => [x * c - y * s + dx, x * s + y * c + dy])
}

export function irregularPlot(n: number): Vec2[] {
  return Array.from({ length: n }, (_, i): Vec2 => {
    const angle = (i / n) * TAU
    const radius = 30 + 10 * Math.sin(i * 1.7) + 5 * Math.cos(i * 3.1)
    return [radius * Math.cos(angle), radius * Math.sin(angle)]
  })
}
