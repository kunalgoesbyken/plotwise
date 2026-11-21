import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import { DUBAI_EXAMPLE_PLOT, EXAMPLE_PLOT, MUMBAI_EXAMPLE_PLOT } from '@/plot/example-plot'
import type { Plot } from '@/plot/plot'
import { loadPack, type PackId } from '@/rules'
import { packInterpretations, purchaseUse, solve, withEveryPurchase, type PurchaseRatios } from '@/solve'
import { plotFromMetres, rectangle } from '@/solve/test-plots'
import { designs } from './designs'
import { headline } from './headline'
import { purchaseCeiling } from './purchase-ceiling'
import { AREA_TOLERANCE_SQM } from './tolerance'

const mumbai = loadPack('mum-suburbs-res')

const solved = (packId: PackId, plot: Plot) => {
  const pack = loadPack(packId)
  return solve(plot, pack, packInterpretations(pack))
}

const standardSqm = ({ limits }: ReturnType<typeof solved>) => limits.far.maxGfaSqm + (limits.inLieu?.gfaSqm ?? 0)

describe('buying every extra floor area the rules allow', () => {
  it('on the Mumbai example, buys each purchase up to its legal maximum for the road width and lifts the cap by all of them', () => {
    const bought = withEveryPurchase(solved('mum-suburbs-res', MUMBAI_EXAMPLE_PLOT))
    const { options } = bought.limits.farPurchase
    expect(options.map((option) => option.kind)).toEqual(mumbai.farPurchases!.map((purchase) => purchase.kind))
    for (const option of options) {
      expect(option.maxExtraGfaSqm).toBeGreaterThan(0)
      expect(option.chosenGfaSqm).toBe(option.maxExtraGfaSqm)
    }
    expect(bought.farCap.mode).toBe('purchased')
    expect(bought.farCap.maxGfaSqm).toBeCloseTo(standardSqm(bought) + options.reduce((sum, option) => sum + option.maxExtraGfaSqm, 0), 6)
  })

  it('keeps the plot, the site and the pack, and buys no more than a user could choose with every slider at its end', () => {
    fc.assert(
      fc.property(fc.integer({ min: 20, max: 80 }), fc.integer({ min: 20, max: 80 }), fc.double({ min: 4, max: 40, noNaN: true }), (widthM, depthM, roadWidthM) => {
        const solution = solved('mum-suburbs-res', plotFromMetres(rectangle(widthM, depthM), [{ edge: 0, widthM: roadWidthM }]))
        const bought = withEveryPurchase(solution)
        expect(bought.plot).toBe(solution.plot)
        expect(bought.site).toBe(solution.site)
        expect(bought.pack).toBe(solution.pack)
        const ends: PurchaseRatios = Object.fromEntries(bought.limits.farPurchase.options.map((o) => [o.kind, o.maxExtraGfaSqm / solution.farAreaSqm]))
        const chosen = solve(solution.plot, mumbai, packInterpretations(mumbai), { mode: 'purchased', ratios: ends })
        expect(bought.farCap.maxGfaSqm).toBeCloseTo(chosen.farCap.maxGfaSqm, 6)
      }),
      { numRuns: 25 },
    )
  })
})

describe('the floor area a plot reaches with every purchase bought', () => {
  it('on the Mumbai example, is more than the headline with nothing bought, and names the purchases its best design uses', () => {
    const solution = solved('mum-suburbs-res', MUMBAI_EXAMPLE_PLOT)
    const options = designs(solution)
    const ceiling = purchaseCeiling(solution, options)!
    const bought = withEveryPurchase(solution)
    const best = headline(designs(bought))!
    expect(ceiling.gfaSqm).toBe(best.metrics.gfaSqm)
    expect(ceiling.gfaSqm - headline(options)!.metrics.gfaSqm).toBeGreaterThan(AREA_TOLERANCE_SQM)
    const used = purchaseUse(bought.limits, best.metrics.gfaSqm).filter((use) => use.usedGfaSqm > 0)
    expect(ceiling.purchases).toEqual(used.map((use) => use.kind))
    expect(ceiling.purchases.length).toBeGreaterThan(0)
  })

  it('is nothing once every purchase is already bought', () => {
    const solution = withEveryPurchase(solved('mum-suburbs-res', MUMBAI_EXAMPLE_PLOT))
    expect(purchaseCeiling(solution, designs(solution))).toBeNull()
  })

  it('is nothing under rules with nothing to buy', () => {
    for (const [packId, plot] of [
      ['bkk-y9', EXAMPLE_PLOT],
      ['dxb-ap', DUBAI_EXAMPLE_PLOT],
    ] as const) {
      const solution = solved(packId, plot)
      expect(purchaseCeiling(solution, designs(solution))).toBeNull()
    }
  })
})
