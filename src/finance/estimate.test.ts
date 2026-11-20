import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import { unverified, value } from '@/rules/test-packs'
import { MONEY_REGIONS, packInterpretations, solve } from '@/solve'
import { plotFromMetres, rectangle } from '@/solve/test-plots'
import { acquisitionShare, financeSite, landResidual } from './estimate'
import { landCheck } from './land-check'
import { resolveValues } from './values'

const region = MONEY_REGIONS.bkk
const defaults = resolveValues(region, { use: 'condo', tier: 'cityFringe' }, {})
const withShares = (shares: { transferCosts: number; holdingCost: number; landFinance: number }) => ({ ...defaults, ...shares })
const share = fc.double({ min: 0, max: 0.5, noNaN: true })
const money = fc.double({ min: 0, max: 1e10, noNaN: true })

describe('landResidual', () => {
  it('equals the old residual when the land costs are zero', () => {
    const values = withShares({ transferCosts: 0, holdingCost: 0, landFinance: 0 })
    const expected = 1_000_000 * (1 - values.margin) - 400_000 * (1 + values.softCost)
    expect(landResidual(1_000_000, 400_000, values)).toBeCloseTo(expected, 6)
  })

  it('divides what is left after building by one plus the land costs', () => {
    const values = withShares({ transferCosts: 0.01, holdingCost: 0.02, landFinance: 0.1 })
    const afterBuild = 1_000_000 * (1 - values.margin) - 400_000 * (1 + values.softCost)
    expect(landResidual(1_000_000, 400_000, values)).toBeCloseTo(afterBuild / 1.13, 6)
  })

  it('leaves exactly the land price plus its costs when the residual is bought', () => {
    fc.assert(
      fc.property(money, money, share, share, share, (gross, build, transferCosts, holdingCost, landFinance) => {
        const values = withShares({ transferCosts, holdingCost, landFinance })
        const land = landResidual(gross, build, values)
        fc.pre(land > 0)
        const spent = land * (1 + acquisitionShare(values)) + build * (1 + values.softCost)
        expect(spent).toBeCloseTo(gross * (1 - values.margin), 3)
      }),
    )
  })

  it('does not shrink a shortfall, since land costs apply only to a land price', () => {
    const values = withShares({ transferCosts: 0.01, holdingCost: 0.02, landFinance: 0.1 })
    const shortfall = 100 * (1 - values.margin) - 400_000 * (1 + values.softCost)
    expect(landResidual(100, 400_000, values)).toBeCloseTo(shortfall, 6)
  })

  it('never rises when a land cost rises', () => {
    fc.assert(
      fc.property(money, money, share, share, (gross, build, low, extra) => {
        const cheap = landResidual(gross, build, withShares({ transferCosts: low, holdingCost: 0, landFinance: 0 }))
        const dear = landResidual(gross, build, withShares({ transferCosts: low + extra, holdingCost: 0, landFinance: 0 }))
        expect(dear).toBeLessThanOrEqual(cheap + 1e-6)
      }),
    )
  })
})

describe('landCheck', () => {
  const reference = { low: defaults.landReferenceLow, high: defaults.landReferenceHigh }

  it('reads the reference from the values', () => {
    expect(landCheck({ low: 0, high: 0 }, defaults, 2).reference).toEqual(reference)
  })

  it('does not warn up to the factor times the high end of the reference', () => {
    expect(landCheck({ low: 0, high: reference.high * 2 }, defaults, 2).exceeds).toBe(false)
  })

  it('warns above the factor times the high end of the reference', () => {
    expect(landCheck({ low: 0, high: reference.high * 2 + 1 }, defaults, 2).exceeds).toBe(true)
  })

  it('warns on any positive value when the reference is edited to zero', () => {
    const zero = { ...defaults, landReferenceLow: 0, landReferenceHigh: 0 }
    expect(landCheck({ low: 0, high: 1 }, zero, 2).exceeds).toBe(true)
    expect(landCheck({ low: 0, high: 0 }, zero, 2).exceeds).toBe(false)
  })
})

describe('financeSite', () => {
  it('prices the whole plot the owner buys, including a strip handed over for road widening', () => {
    for (const farOn of ['gross', 'net'] as const) {
      const pack = unverified({ reservations: [{ kind: 'roadWidening', targetWidthM: value(12), farOn, notes: [] }] })
      const solution = solve(plotFromMetres(rectangle(40, 50), [{ edge: 0, widthM: 8 }]), pack, packInterpretations(pack))
      expect(solution.site.areaSqm).toBeCloseTo(1920, 6)
      expect(financeSite(solution, region).plotAreaSqm).toBeCloseTo(2000, 6)
    }
  })
})
