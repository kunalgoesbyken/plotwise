import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import { totalArea } from '@/geometry'
import { BUILDING_TYPES, type BuildingType } from '@/plot/plot'
import { loadPack } from '@/rules'
import { packInterpretations, solve, type Envelope } from '@/solve'
import { plotFromMetres, rectangle } from '@/solve/test-plots'
import { bindingRules, carvingRules, citeKey, envelopeAt, envelopeLayers, RULE_STEPS, setbackRule } from './rule-layers'

const pack = loadPack('bkk-y9')
const readings = packInterpretations(pack)
const rules = carvingRules(pack)

type LotInput = { width: number; depth: number; road: number; side: number | undefined; type: BuildingType }

const lot: fc.Arbitrary<LotInput> = fc.record({
  width: fc.integer({ min: 20, max: 160 }),
  depth: fc.integer({ min: 20, max: 160 }),
  road: fc.integer({ min: 4, max: 40 }),
  side: fc.option(fc.integer({ min: 4, max: 30 }), { nil: undefined }),
  type: fc.constantFrom(...BUILDING_TYPES),
})

function solved({ width, depth, road, side, type }: LotInput) {
  const roads = [{ edge: 0, widthM: road }, ...(side === undefined ? [] : [{ edge: 1, widthM: side }])]
  return solve(plotFromMetres(rectangle(width, depth), roads, type), pack, readings)
}

const groundArea = (prisms: ReturnType<typeof envelopeAt>) => totalArea(prisms[0]?.polygons ?? [])
const nonEmpty = (envelope: Envelope) => envelope.prisms.length > 0

describe('carving rules', () => {
  it('gives every setback the engine applies a rule to carve under', () => {
    fc.assert(
      fc.property(lot, (input) => {
        for (const envelope of solved(input).envelopes)
          for (const tier of envelope.tiers)
            for (const setback of tier.setbacks) {
              if (setback.distanceM === 0) continue
              expect(setback.cites.some((cite) => rules.has(citeKey(cite)))).toBe(true)
              expect(setbackRule(setback, rules)).not.toBeNull()
            }
      }),
      { numRuns: 80 },
    )
  })

  it('puts the 6 m high-rise distance and the height-to-road step-back in their own steps', () => {
    const solution = solved({ width: 60, depth: 80, road: 12, side: undefined, type: 'condo' })
    const highRise = solution.envelopes.find((e) => e.kind === 'highRise')!
    expect([...bindingRules(highRise, rules)].sort()).toEqual(['height-vs-road', 'high-rise'])
    const ordinary = solution.envelopes.find((e) => e.kind === 'ordinary')!
    expect(bindingRules(ordinary, rules).has('high-rise')).toBe(false)
  })
})

describe('envelopeAt', () => {
  it('is the engine envelope once every rule is applied, and the bare plot before any', () => {
    fc.assert(
      fc.property(lot, (input) => {
        const solution = solved(input)
        for (const envelope of solution.envelopes.filter(nonEmpty)) {
          expect(envelopeAt(envelope, solution.site, 'high-rise', rules)).toBe(envelope.prisms)
          expect(groundArea(envelopeAt(envelope, solution.site, 'plot', rules))).toBeCloseTo(solution.site.areaSqm, 0)
        }
      }),
      { numRuns: 40 },
    )
  })

  it('only ever shrinks the envelope as each rule is added', () => {
    fc.assert(
      fc.property(lot, (input) => {
        const solution = solved(input)
        for (const envelope of solution.envelopes.filter(nonEmpty)) {
          const areas = RULE_STEPS.map((step) => groundArea(envelopeAt(envelope, solution.site, step, rules)))
          areas.slice(1).forEach((area, i) => expect(area).toBeLessThanOrEqual(areas[i] + 1e-6))
        }
      }),
      { numRuns: 40 },
    )
  })
})

describe('envelopeLayers', () => {
  const solution = solved({ width: 60, depth: 80, road: 12, side: undefined, type: 'condo' })
  const highRise = solution.envelopes.find((e) => e.kind === 'highRise')!
  const ordinary = solution.envelopes.find((e) => e.kind === 'ordinary')!

  it('offers the plot and only the rules that bind on this envelope', () => {
    expect(envelopeLayers(highRise, solution.site, 'high-rise', rules).steps).toEqual(['plot', 'height-vs-road', 'high-rise'])
    expect(envelopeLayers(ordinary, solution.site, 'high-rise', rules).steps).toEqual(['plot', 'setbacks'])
  })

  it('falls back to the last binding step and shows what the step before it carved away', () => {
    const layers = envelopeLayers(ordinary, solution.site, 'high-rise', rules)
    expect(layers.step).toBe('setbacks')
    expect(layers.shown).toBe(ordinary.prisms)
    expect(groundArea(layers.carved!)).toBeCloseTo(solution.site.areaSqm, 0)
    expect(envelopeLayers(ordinary, solution.site, 'plot', rules).carved).toBeNull()
  })
})
