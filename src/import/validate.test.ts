import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import { localFrame, type LngLat } from '@/geo/projection'
import { starPolygon } from '@/geometry/arbitraries'
import { MAX_CORNERS } from '@/plot/plot'
import { ASSUMPTIONS } from '@/solve'
import type { Georef, Pair, Shape } from './types'
import { checkShape, shapeAreaSqm, shapeProblem, type Bounds } from './validate'

const BOUNDS: Bounds = [97.3, 5.6, 105.7, 20.5]
const DEGREES: Georef = { kind: 'degrees', order: 'lng-lat' }
const PLOT: readonly Pair[] = [
  [100.575355, 13.77867],
  [100.57568, 13.778661],
  [100.575694, 13.779116],
  [100.575382, 13.779044],
]

const shape = (points: readonly Pair[], closed = true, curved = false): Shape => ({ name: null, points, closed, curved })

function reason(result: ReturnType<typeof checkShape>) {
  return result.ok ? null : result.problem.reason
}

describe('checkShape', () => {
  it('accepts a closed simple outline and reports its area', () => {
    const result = checkShape(shape(PLOT), DEGREES, BOUNDS)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.ring).toEqual(PLOT.map(([lng, lat]): LngLat => [lng, lat]))
      expect(result.value.areaSqm).toBeGreaterThan(1500)
      expect(result.value.areaSqm).toBeLessThan(2000)
    }
  })

  it('refuses an open ring', () => {
    expect(reason(checkShape(shape(PLOT, false), DEGREES, BOUNDS))).toBe('open-ring')
  })

  it('refuses a curved outline, which a straight-edged plot cannot represent', () => {
    expect(reason(checkShape(shape(PLOT, true, true), DEGREES, BOUNDS))).toBe('dxf-curved')
  })

  it('refuses fewer than three corners', () => {
    expect(reason(checkShape(shape(PLOT.slice(0, 2)), DEGREES, BOUNDS))).toBe('too-few-corners')
  })

  it('refuses more corners than the drawing limit', () => {
    const many = Array.from({ length: MAX_CORNERS + 1 }, (_, i): Pair => [100.5 + Math.cos(i) * 0.001, 13.7 + Math.sin(i) * 0.001])
    expect(reason(checkShape(shape(many), DEGREES, BOUNDS))).toBe('too-many-corners')
  })

  it('refuses an outline that crosses itself', () => {
    const bowtie: readonly Pair[] = [
      [100.5, 13.7],
      [100.501, 13.701],
      [100.501, 13.7],
      [100.5, 13.701],
    ]
    expect(reason(checkShape(shape(bowtie), DEGREES, BOUNDS))).toBe('crossing')
  })

  it('refuses corners that all lie in a line', () => {
    const line: readonly Pair[] = [
      [100.5, 13.7],
      [100.501, 13.7],
      [100.502, 13.7],
    ]
    expect(reason(checkShape(shape(line), DEGREES, BOUNDS))).toBe('degenerate')
  })

  it('refuses coordinates that are not on Earth', () => {
    expect(reason(checkShape(shape([[200, 13.7], [201, 13.7], [201, 13.8]]), DEGREES, BOUNDS))).toBe('out-of-range')
    expect(reason(checkShape(shape([[Number.NaN, 13.7], [100.1, 13.7], [100.1, 13.8]]), DEGREES, BOUNDS))).toBe('out-of-range')
  })

  it('refuses an outline outside the region', () => {
    const swapped: Georef = { kind: 'degrees', order: 'lat-lng' }
    expect(reason(checkShape(shape(PLOT), swapped, BOUNDS))).toBe('out-of-range')
    const elsewhere: readonly Pair[] = [
      [77.59, 12.97],
      [77.591, 12.97],
      [77.591, 12.971],
    ]
    expect(reason(checkShape(shape(elsewhere), DEGREES, BOUNDS))).toBe('outside-region')
  })

  it('refuses an outline smaller or larger than the plausible plot range', () => {
    const at = PLOT[0]
    const frame = localFrame(at)
    const square = (sideM: number): Shape => shape([[0, 0], [sideM, 0], [sideM, sideM], [0, sideM]].map(([x, y]) => frame.toLngLat([x, y]) as Pair))
    const { importMinPlotSqm, importMaxPlotSqm } = ASSUMPTIONS
    expect(reason(checkShape(square(Math.sqrt(importMinPlotSqm.value) * 0.9), DEGREES, BOUNDS))).toBe('too-small')
    expect(reason(checkShape(square(Math.sqrt(importMaxPlotSqm.value) * 1.1), DEGREES, BOUNDS))).toBe('too-large')
    expect(checkShape(square(Math.sqrt(importMinPlotSqm.value) * 1.1), DEGREES, BOUNDS).ok).toBe(true)
  })

  it('accepts every simple outline of plot size', () => {
    fc.assert(
      fc.property(starPolygon(20), (local) => {
        const frame = localFrame([100.52, 13.72])
        const points = local.map((p): Pair => frame.toLngLat(p))
        const result = checkShape(shape(points), DEGREES, BOUNDS)
        expect(result.ok).toBe(true)
      }),
    )
  })
})

describe('shapeAreaSqm', () => {
  it('measures an outline whether or not it passes the checks', () => {
    expect(shapeAreaSqm(shape(PLOT), DEGREES)).toBeGreaterThan(1500)
    expect(shapeAreaSqm(shape([]), DEGREES)).toBe(0)
  })
})

describe('shapeProblem', () => {
  it('names what is wrong with a shape before any placement is known', () => {
    expect(shapeProblem(shape(PLOT))).toBeNull()
    expect(shapeProblem(shape(PLOT, false))).toBe('open-ring')
    expect(shapeProblem(shape(PLOT, true, true))).toBe('dxf-curved')
    expect(shapeProblem(shape(PLOT, false, true))).toBe('dxf-curved')
  })
})
