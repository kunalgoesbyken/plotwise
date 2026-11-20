import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import type { Vec2 } from '@/geo/projection'
import { convexPolygon, starPolygon } from '@/geometry/arbitraries'
import { EXAMPLE_PLOT } from '@/plot/example-plot'
import type { BuildingType, Plot } from '@/plot/plot'
import { loadPack } from '@/rules'
import { packInterpretations, satisfies, solve, withoutHighRiseRules, type Solution } from '@/solve'
import { plotFromMetres, rectangle } from '@/solve/test-plots'
import { designs } from './designs'
import { headline } from './headline'
import { highRiseCost } from './high-rise-cost'
import { AREA_TOLERANCE_SQM } from './tolerance'

const pack = loadPack('bkk-y9')
const readings = packInterpretations(pack)

function designed(plot: Plot) {
  const solution = solve(plot, pack, readings)
  return { solution, options: designs(solution) }
}

const waivedBest = (solution: Solution) => headline(designs(withoutHighRiseRules(solution)))!.metrics.gfaSqm

describe('waiving the high-rise rules', () => {
  it('keeps the floor area cap and every other limit, and drops only the high-rise class', () => {
    const { solution } = designed(EXAMPLE_PLOT)
    const waived = withoutHighRiseRules(solution)
    expect(waived.farCap).toEqual(solution.farCap)
    expect(waived.limits.far).toEqual(solution.limits.far)
    expect(waived.limits.height).toEqual(solution.limits.height)
    expect(waived.limits.openSpace).toEqual(solution.limits.openSpace)
    expect(waived.limits.highRise).toBeNull()
    expect(waived.pack).toBe(solution.pack)
    expect(waived.envelopes.map((e) => e.kind)).toEqual(['ordinary'])
  })

  it('lets the ordinary envelope rise past the high-rise threshold on the Bangkok example', () => {
    const { solution } = designed(EXAMPLE_PLOT)
    const [ordinary] = withoutHighRiseRules(solution).envelopes
    expect(satisfies(ordinary.prisms.at(-1)!.topM, pack.buildingClasses!.highRiseFromHeightM)).toBe(true)
  })

  it('builds no less on the Bangkok example when every road widens from 7 m to 8 m', () => {
    const withRoads = (widthM: number): Plot => ({ ...EXAMPLE_PLOT, roads: EXAMPLE_PLOT.roads.map((road) => ({ ...road, widthM })) })
    const [narrow, wider] = [7, 8].map((widthM) => waivedBest(designed(withRoads(widthM)).solution))
    expect(wider).toBeGreaterThanOrEqual(narrow - AREA_TOLERANCE_SQM)
  })

  it('never stops a design at the building class', () => {
    fc.assert(
      fc.property(fc.oneof(convexPolygon(10), starPolygon(16)), fc.double({ min: 4, max: 40, noNaN: true }), (points: Vec2[], roadWidthM) => {
        const { solution } = designed(plotFromMetres(points, [{ edge: 0, widthM: roadWidthM }]))
        for (const d of designs(withoutHighRiseRules(solution))) expect(d.limitedBy).not.toBe('building-class')
      }),
      { numRuns: 20 },
    )
  })
})

describe('what the high-rise rules cost a plot', () => {
  it('on the Bangkok example, is the floor area the best design gains without them, still within the cap', () => {
    const { solution, options } = designed(EXAMPLE_PLOT)
    const best = headline(options)!
    expect(best.limitedBy).toBe('building-class')
    const cost = highRiseCost(solution, options)!
    expect(cost).toBeGreaterThan(AREA_TOLERANCE_SQM)
    expect(best.metrics.gfaSqm + cost).toBeLessThanOrEqual(solution.farCap.maxGfaSqm + AREA_TOLERANCE_SQM)
    expect(best.metrics.gfaSqm + cost).toBeCloseTo(waivedBest(solution), 6)
  })

  it('is nothing when the best design already reaches the cap', () => {
    const { solution, options } = designed(plotFromMetres(rectangle(50, 70), [{ edge: 0, widthM: 16 }]))
    expect(headline(options)!.limitedBy).toBe('far')
    expect(highRiseCost(solution, options)).toBeNull()
  })

  it('is nothing under rules with no high-rise class', () => {
    const dubai = loadPack('dxb-ap')
    const plot: Plot = { ...plotFromMetres(rectangle(40, 30), [{ edge: 0, widthM: 12 }]), limits: { maxFar: 3.5, maxStoreys: 9 } }
    const solution = solve(plot, dubai, packInterpretations(dubai))
    expect(highRiseCost(solution, designs(solution))).toBeNull()
  })

  it('on any plot, is positive only when the high-rise rules stop the best design, and never lifts it past the cap', () => {
    fc.assert(
      fc.property(
        fc.oneof(convexPolygon(10), starPolygon(16)),
        fc.double({ min: 4, max: 40, noNaN: true }),
        fc.constantFrom<BuildingType>('condo', 'office', 'hotel'),
        (points: Vec2[], roadWidthM, buildingType) => {
          const { solution, options } = designed(plotFromMetres(points, [{ edge: 0, widthM: roadWidthM }], buildingType))
          const cost = highRiseCost(solution, options)
          if (cost === null) return
          const best = headline(options)!
          expect(best.limitedBy).toBe('building-class')
          expect(cost).toBeGreaterThan(AREA_TOLERANCE_SQM)
          expect(best.metrics.gfaSqm + cost).toBeLessThanOrEqual(solution.farCap.maxGfaSqm + AREA_TOLERANCE_SQM)
        },
      ),
      { numRuns: 30 },
    )
  })
})
