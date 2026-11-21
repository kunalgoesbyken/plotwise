import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import type { Vec2 } from '@/geo/projection'
import { convexPolygon, starPolygon } from '@/geometry/arbitraries'
import { EXAMPLE_PLOT } from '@/plot/example-plot'
import type { BuildingType, Plot } from '@/plot/plot'
import { loadPack } from '@/rules'
import { packInterpretations, satisfies, solve, withoutHighRiseRules, type Solution } from '@/solve'
import { plotFromMetres, rectangle } from '@/solve/test-plots'
import { AREA_UNITS, areaToDisplay, type AreaUnit } from '@/units/area'
import { capBreakdown, capOf, type CapFigures } from './cap-breakdown'
import { designs, type Design } from './designs'
import { headline } from './headline'
import { AREA_TOLERANCE_SQM } from './tolerance'

const pack = loadPack('bkk-y9')
const readings = packInterpretations(pack)

function designed(plot: Plot) {
  const solution = solve(plot, pack, readings)
  return { solution, options: designs(solution) }
}

const waivedBest = (solution: Solution) => headline(designs(withoutHighRiseRules(solution)))!

const shownIn = (unit: AreaUnit) => (sqm: number) => Math.round(areaToDisplay(sqm, unit))

function expectSteps(figures: CapFigures | null, solution: Solution, best: Design, unit: AreaUnit) {
  expect(figures).not.toBeNull()
  if (figures?.kind !== 'short') return
  const shown = shownIn(unit)
  const steps = figures.losses.map((loss) => shown(loss.sqm))
  expect(shown(figures.capSqm)).toBe(shown(solution.farCap.maxGfaSqm))
  expect(shown(figures.buildableSqm)).toBe(shown(best.metrics.gfaSqm))
  expect(shown(figures.capSqm) - steps.reduce((sum, step) => sum + step, 0)).toBe(shown(figures.buildableSqm))
  for (const step of steps) expect(step).toBeGreaterThanOrEqual(0)
  if (best.limitedBy !== 'building-class') expect(figures.losses.map((loss) => loss.limitedBy)).not.toContain('building-class')
}

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
    const [narrow, wider] = [7, 8].map((widthM) => waivedBest(designed(withRoads(widthM)).solution).metrics.gfaSqm)
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

describe('the steps from the legal cap down to the buildable floor area', () => {
  it('on the Bangkok example, takes what the setbacks and road-height rule take, then what the high-rise rules take, down to the best design', () => {
    const { solution, options } = designed(EXAMPLE_PLOT)
    const best = headline(options)!
    const waived = waivedBest(solution)
    expect(best.limitedBy).toBe('building-class')
    for (const unit of AREA_UNITS) {
      const figures = capBreakdown(solution, options, unit)
      expectSteps(figures, solution, best, unit)
      if (figures?.kind !== 'short') throw new Error('the Bangkok example reaches its cap')
      const shown = shownIn(unit)
      expect(figures.losses.map((loss) => [loss.limitedBy, shown(loss.sqm)])).toEqual([
        ['envelope', shown(solution.farCap.maxGfaSqm) - shown(waived.metrics.gfaSqm)],
        ['building-class', shown(waived.metrics.gfaSqm) - shown(best.metrics.gfaSqm)],
      ])
      for (const loss of figures.losses) expect(loss.sqm).toBeGreaterThan(AREA_TOLERANCE_SQM)
    }
    expect(waived.limitedBy).toBe('envelope')
  })

  it('says only that the cap is reached when the best design reaches it', () => {
    const { solution, options } = designed(plotFromMetres(rectangle(50, 70), [{ edge: 0, widthM: 16 }]))
    expect(headline(options)!.limitedBy).toBe('far')
    expect(capBreakdown(solution, options, 'sqm')).toEqual({ kind: 'reached', capSqm: solution.farCap.maxGfaSqm })
  })

  it('has no high-rise step under rules with no high-rise class', () => {
    const dubai = loadPack('dxb-ap')
    const plot: Plot = { ...plotFromMetres(rectangle(40, 30), [{ edge: 0, widthM: 12 }]), limits: { maxFar: 3.5, maxStoreys: 9 } }
    const solution = solve(plot, dubai, packInterpretations(dubai))
    const options = designs(solution)
    const figures = capBreakdown(solution, options, 'sqm')
    if (figures?.kind !== 'short') return
    const [only, ...rest] = figures.losses
    expect(rest).toEqual([])
    expect(only.limitedBy as string).toBe(headline(options)!.limitedBy)
    expectSteps(figures, solution, headline(options)!, 'sqm')
  })

  it('has nothing to break down when no design fits', () => {
    const { solution } = designed(EXAMPLE_PLOT)
    expect(capBreakdown(solution, [], 'sqm')).toBeNull()
  })

  it('on any plot and in either unit, adds up exactly in the whole numbers shown, loses nothing below zero, and takes a high-rise step only when the building class stops the best design', () => {
    fc.assert(
      fc.property(
        fc.oneof(convexPolygon(10), starPolygon(16)),
        fc.double({ min: 4, max: 40, noNaN: true }),
        fc.constantFrom<BuildingType>('condo', 'office', 'hotel'),
        fc.constantFrom(...AREA_UNITS),
        (points: Vec2[], roadWidthM, buildingType, unit) => {
          const { solution, options } = designed(plotFromMetres(points, [{ edge: 0, widthM: roadWidthM }], buildingType))
          const best = headline(options)
          if (!best) return
          const figures = capBreakdown(solution, options, unit)
          expect(figures?.kind).toBe(best.limitedBy === 'far' ? 'reached' : 'short')
          expectSteps(figures, solution, best, unit)
        },
      ),
      { numRuns: 60 },
    )
  })
})

describe('the cap shown under a design that is not the headline', () => {
  it('is the cap alone, reached or not, with no steps', () => {
    const { solution, options } = designed(EXAMPLE_PLOT)
    const best = headline(options)!
    for (const design of options.filter((d) => d !== best)) {
      expect(capOf(design, solution)).toEqual({ kind: design.limitedBy === 'far' ? 'reached' : 'legal', capSqm: solution.farCap.maxGfaSqm })
    }
  })
})
