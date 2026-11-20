import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import { designs, type CheckId, type Design } from '@/designs'
import type { PlotLimits } from '@/plot/plot'
import { containsEntered, enteredCite, isSourceCite, loadPack, type Cite, type RulePack } from '@/rules'
import { SolveError } from './errors'
import { packInterpretations } from './interpretations'
import { isParkingUnset, plotLimitFields } from './plot-limits'
import { solve } from './solve'
import { plotFromMetres, rectangle } from './test-plots'

const CUSTOM = loadPack('custom')
const DUBAI = loadPack('dxb-ap')

const REQUIRED: PlotLimits = { maxGfaSqm: 5000, maxStoreys: 10 }

const lot = (limits: PlotLimits, widthM = 40, depthM = 50) => ({ ...plotFromMetres(rectangle(widthM, depthM), [{ edge: 0, widthM: 12 }]), limits })

const solveWith = (pack: RulePack, limits: PlotLimits) => solve(lot(limits), pack, packInterpretations(pack))

function sourceCites(node: unknown): Cite[] {
  if (Array.isArray(node)) return node.flatMap(sourceCites)
  if (node === null || typeof node !== 'object') return []
  if ('quote' in node && 'page' in node && isSourceCite(node as Cite)) return [node as Cite]
  return Object.values(node).flatMap(sourceCites)
}

describe('packs whose every limit is entered for the plot', () => {
  it('asks for every limit a user can know, and holds no rule value of its own', () => {
    expect(plotLimitFields(CUSTOM)).toEqual([
      'maxGfaSqm',
      'maxFar',
      'maxHeightM',
      'maxStoreys',
      'maxCoverageShare',
      'roadSetbackM',
      'boundarySetbackM',
      'minOpenSpaceShare',
      'parkingSqmPerSpace',
    ])
    expect(sourceCites(CUSTOM)).toEqual([])
    expect(containsEntered(CUSTOM)).toBe(false)
  })

  it('asks a Dubai plot for what its affection plan states, and holds no rule value of its own', () => {
    expect(plotLimitFields(DUBAI)).toEqual([
      'maxGfaSqm',
      'maxFar',
      'maxHeightM',
      'maxStoreys',
      'maxCoverageShare',
      'roadSetbackM',
      'boundarySetbackM',
      'parkingSqmPerSpace',
    ])
    expect(sourceCites(DUBAI)).toEqual([])
  })

  it('marks every result unverified', () => {
    for (const pack of [CUSTOM, DUBAI]) {
      expect(pack.verification).toBe('unverified')
      expect(solveWith(pack, REQUIRED).verification).toBe('unverified')
    }
  })
})

describe('entered floor area', () => {
  it('takes the floor area from a ratio alone', () => {
    const { far } = solveWith(CUSTOM, { maxFar: 2.5, maxStoreys: 10 }).limits
    expect(far.maxGfaSqm).toBeCloseTo(5000, 3)
    expect(far.ratio).toBeCloseTo(2.5, 12)
    expect(far.cites).toEqual([enteredCite('maxFar')])
  })

  it('takes the lower of an entered floor area and ratio, citing both', () => {
    const { far } = solveWith(CUSTOM, { maxGfaSqm: 4000, maxFar: 2.5, maxStoreys: 10 }).limits
    expect(far.maxGfaSqm).toBeCloseTo(4000, 9)
    expect(far.cites).toEqual([enteredCite('maxGfaSqm'), enteredCite('maxFar')])
  })

  it('refuses to solve without either, naming both', () => {
    const solving = () => solveWith(CUSTOM, { maxStoreys: 10 })
    expect(solving).toThrow(SolveError)
    try {
      solving()
    } catch (error) {
      expect((error as SolveError).fields).toEqual(['maxGfaSqm', 'maxFar'])
    }
  })
})

describe('entered coverage, open space and parking are optional', () => {
  it('leaves coverage, open space and parking out when they are not entered', () => {
    const { limits } = solveWith(CUSTOM, REQUIRED)
    expect(limits.coverage).toBeNull()
    expect(limits.openSpace.minimums).toEqual([])
    expect(limits.parking.rules).toEqual([])
    for (const design of designs(solveWith(CUSTOM, REQUIRED))) expect(design.checks.map((c) => c.id)).not.toContain('coverage')
  })

  it('caps coverage at the entered share when given', () => {
    const solution = solveWith(CUSTOM, { ...REQUIRED, maxCoverageShare: 0.4 })
    const { share, maxFootprintSqm, cites } = solution.limits.coverage!
    expect([share, cites]).toEqual([0.4, [enteredCite('maxCoverageShare')]])
    expect(maxFootprintSqm).toBeCloseTo(800, 6)
    for (const design of designs(solution)) expect(design.checks.find((c) => c.id === 'coverage')).toMatchObject({ status: 'pass' })
  })

  it('keeps the entered share of the plot open, for every use', () => {
    for (const buildingType of ['condo', 'office', 'hotel'] as const) {
      const plot = { ...lot({ ...REQUIRED, minOpenSpaceShare: 0.3 }), buildingType }
      const solution = solve(plot, CUSTOM, packInterpretations(CUSTOM))
      expect(solution.limits.openSpace.minimums).toEqual([
        { scope: 'anyBuilding', base: 'landArea', share: 0.3, cites: [enteredCite('minOpenSpaceShare')] },
      ])
      for (const design of designs(solution)) {
        expect(design.plates.footprintSqm).toBeLessThanOrEqual(0.7 * 2000 + 1e-6)
        expect(design.checks.find((c) => c.id === 'open-space-minimum')).toMatchObject({ status: 'pass' })
      }
    }
  })

  it('asks one parking space per the entered floor area', () => {
    const solution = solveWith(CUSTOM, { ...REQUIRED, parkingSqmPerSpace: 50 })
    const [rule] = solution.limits.parking.rules
    expect(rule).toMatchObject({ scope: 'entered', condo: { kind: 'perGrossArea', sqmPerSpace: { value: 50 } } })
    for (const design of designs(solution)) expect(design.metrics.parkingSpaces).toBeGreaterThan(0)
  })

  it('says parking is not set only when the plot asks for it and it was left blank', () => {
    expect(isParkingUnset(solveWith(CUSTOM, REQUIRED))).toBe(true)
    expect(isParkingUnset(solveWith(DUBAI, REQUIRED))).toBe(true)
    expect(isParkingUnset(solveWith(CUSTOM, { ...REQUIRED, parkingSqmPerSpace: 50 }))).toBe(false)
    expect(isParkingUnset(solveWith(DUBAI, { ...REQUIRED, parkingSqmPerSpace: 50 }))).toBe(false)
    for (const id of ['bkk-y9', 'mum-suburbs-res'] as const) {
      const pack = loadPack(id)
      expect(isParkingUnset(solve(lot({}), pack, packInterpretations(pack)))).toBe(false)
    }
  })
})

describe('a per-plot setback or open space left blank', () => {
  const MUMBAI = loadPack('mum-suburbs-res')
  const mumbaiLot = (limits: PlotLimits) => ({ ...plotFromMetres(rectangle(40, 50), [{ edge: 0, widthM: 18 }]), limits })
  const checkOf = (design: Design, id: CheckId) => design.checks.find((c) => c.id === id)

  it.each([
    ['boundary-setback', 'boundarySetbackM'],
    ['road-setback', 'roadSetbackM'],
    ['open-space-minimum', 'minOpenSpaceShare'],
  ] as const)('leaves %s to check, naming the limit not entered, for custom rules', (id, field) => {
    const solution = solveWith(CUSTOM, REQUIRED)
    expect(designs(solution).length).toBeGreaterThan(0)
    for (const design of designs(solution)) expect(checkOf(design, id)).toEqual({ id, status: 'manual', unentered: field, cites: [] })
  })

  it('leaves the setbacks to check for a Dubai plot whose affection plan gives none', () => {
    for (const design of designs(solveWith(DUBAI, REQUIRED))) {
      expect(checkOf(design, 'boundary-setback')).toMatchObject({ status: 'manual', unentered: 'boundarySetbackM' })
      expect(checkOf(design, 'road-setback')).toMatchObject({ status: 'manual', unentered: 'roadSetbackM' })
      expect(checkOf(design, 'open-space-minimum')).toBeUndefined()
    }
  })

  it('leaves Mumbai side and rear open space to check, citing the table it comes from', () => {
    const solution = solve(mumbaiLot({}), MUMBAI, packInterpretations(MUMBAI))
    expect(designs(solution).length).toBeGreaterThan(0)
    for (const design of designs(solution)) {
      expect(checkOf(design, 'boundary-setback')).toEqual({
        id: 'boundary-setback',
        status: 'manual',
        unentered: 'boundarySetbackM',
        cites: MUMBAI.plotSetbacks!.notes,
      })
      expect(checkOf(design, 'road-setback')).toMatchObject({ status: 'pass' })
    }
  })

  it('checks the setbacks and open space once they are entered', () => {
    const solution = solveWith(CUSTOM, { ...REQUIRED, roadSetbackM: 4, boundarySetbackM: 3, minOpenSpaceShare: 0.3 })
    for (const design of designs(solution)) {
      expect(checkOf(design, 'boundary-setback')).toMatchObject({ status: 'pass', limit: 3, cites: [enteredCite('boundarySetbackM')] })
      expect(checkOf(design, 'road-setback')).toMatchObject({ status: 'pass', limit: 4, cites: [enteredCite('roadSetbackM')] })
      expect(checkOf(design, 'open-space-minimum')).toMatchObject({ status: 'pass' })
    }
    for (const design of designs(solve(mumbaiLot({ boundarySetbackM: 6 }), MUMBAI, packInterpretations(MUMBAI)))) {
      expect(checkOf(design, 'boundary-setback')).toMatchObject({ status: 'pass', limit: 6 })
    }
  })

  it('never passes a setback or open space against a limit nobody entered', () => {
    const blankOr = (max: number) => fc.option(fc.double({ min: 0.5, max, noNaN: true }), { nil: undefined })
    const blankable = fc.record({ roadSetbackM: blankOr(6), boundarySetbackM: blankOr(4), minOpenSpaceShare: blankOr(0.6) })
    fc.assert(
      fc.property(blankable, fc.constantFrom(CUSTOM, DUBAI), (entered, pack) => {
        for (const design of designs(solveWith(pack, { ...REQUIRED, ...entered }))) {
          for (const check of design.checks) {
            if (check.status === 'manual' || !['boundary-setback', 'road-setback', 'open-space-minimum'].includes(check.id)) continue
            expect(check.cites.length).toBeGreaterThan(0)
          }
        }
      }),
      { numRuns: 25 },
    )
  })
})

describe('designs from entered limits', () => {
  const limits = fc.record({
    maxGfaSqm: fc.double({ min: 500, max: 20_000, noNaN: true }),
    maxStoreys: fc.integer({ min: 1, max: 40 }),
    maxCoverageShare: fc.double({ min: 0.2, max: 1, noNaN: true }),
    roadSetbackM: fc.double({ min: 0, max: 6, noNaN: true }),
    boundarySetbackM: fc.double({ min: 0, max: 4, noNaN: true }),
  })

  it('keep within the entered floor area and height, each with its pass or fail checks', () => {
    fc.assert(
      fc.property(limits, (entered) => {
        const solution = solveWith(DUBAI, entered)
        for (const design of designs(solution)) {
          expect(design.checks.find((c) => c.id === 'far')).toMatchObject({ status: 'pass' })
          expect(design.checks.find((c) => c.id === 'height-cap')).toMatchObject({ status: 'pass' })
          expect(design.metrics.storeys).toBeLessThanOrEqual(entered.maxStoreys)
        }
      }),
      { numRuns: 25 },
    )
  })
})
