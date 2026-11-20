import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import { siteOf } from '@/plot/site'
import { loadPack } from '@/rules'
import { sideRearCeilingM, sideRearLimit, sideRearOpenSpace, storeysToHold, type SideRearLimit } from './side-rear'
import { plotFromMetres, rectangle } from './test-plots'

const MUMBAI = loadPack('mum-suburbs-res')

const limitOf = (widthM: number, depthM: number): SideRearLimit => sideRearLimit(MUMBAI, siteOf(plotFromMetres(rectangle(widthM, depthM), [{ edge: 0, widthM: 9 }])))!

const SMALL = limitOf(10, 12)
const LARGE = limitOf(43, 43)

describe('Table A plot class', () => {
  it('puts a plot up to 1000 m², or under 20 m wide or deep on average, in the smaller class', () => {
    expect([limitOf(10, 12), limitOf(40, 25), limitOf(60, 19), limitOf(19, 60)].map((limit) => limit.plotClass)).toEqual(['small', 'small', 'small', 'small'])
  })

  it('puts a plot over 1000 m² and at least 20 m wide and deep on average in the larger class', () => {
    expect([limitOf(43, 43), limitOf(50, 22), limitOf(60, 20)].map((limit) => limit.plotClass)).toEqual(['large', 'large', 'large'])
  })

  it('averages width and depth along and across the main road, whichever way the plot is turned', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 2 * Math.PI, noNaN: true }), (angle) => {
        const turn = ([x, y]: readonly [number, number]): [number, number] => [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)]
        const plot = plotFromMetres(rectangle(50, 22).map(turn), [{ edge: 0, widthM: 9 }])
        expect(sideRearLimit(MUMBAI, siteOf(plot))!.plotClass).toBe('large')
      }),
    )
  })

  it('has no Table A where the pack has none', () => {
    expect(sideRearLimit(loadPack('bkk-y9'), siteOf(plotFromMetres(rectangle(43, 43), [{ edge: 0, widthM: 9 }])))).toBeNull()
  })
})

describe('Table A open space by building height', () => {
  const at = (limit: SideRearLimit, heightM: number) => sideRearOpenSpace(limit, heightM).distanceM

  it('is H/5, at least 3.6 m, up to 32 m, then H/5 up to 12 m to 70 m on the smaller plot class', () => {
    expect([10, 18, 25, 32, 40, 60, 70].map((h) => at(SMALL, h))).toEqual([3.6, 3.6, 5, 6.4, 8, 12, 12])
  })

  it('is H/4, at least 3.6 m, up to 32 m, then H/4 up to 12 m to 70 m, 16 m to 120 m and 20 m above on the larger plot class', () => {
    expect([10, 14.4, 20, 32, 40, 48, 70, 80, 120, 130].map((h) => at(LARGE, h))).toEqual([3.6, 3.6, 5, 8, 10, 12, 12, 16, 16, 20])
  })

  it('cites the rule and the Table A cells it is read from', () => {
    const { cites } = sideRearOpenSpace(SMALL, 10)
    expect(cites.map((cite) => ('clause' in cite ? cite.clause : null))).toEqual(['Reg 41(2)(i)(a)', 'Reg 41(2)(i)(a) Table A', 'Reg 41(2)(i)(a) Table A'])
  })

  it('stops the smaller plot class at 70 m, where Table A leaves its cells blank, and leaves the larger class open', () => {
    expect(sideRearCeilingM(SMALL)).toBe(70)
    expect(sideRearCeilingM(LARGE)).toBe(Infinity)
  })

  it('fails loudly for a height Table A leaves blank', () => {
    expect(() => sideRearOpenSpace(SMALL, 71)).toThrow()
  })

  it('tries the tallest height at the smallest open space, then every storey where the open space grows', () => {
    expect(storeysToHold(SMALL, 3.1, 8)).toEqual([5, 6, 7, 8])
    expect(storeysToHold(LARGE, 3.1, 8)).toEqual([4, 5, 6, 7, 8])
    expect(storeysToHold(LARGE, 3.1, 3)).toEqual([3])
  })

  it('never shrinks as the building gets taller and never falls below the 3.6 m minimum', () => {
    fc.assert(
      fc.property(fc.constantFrom(SMALL, LARGE), fc.double({ min: 0, max: 70, noNaN: true }), fc.double({ min: 0, max: 70, noNaN: true }), (limit, a, b) => {
        const [low, high] = a < b ? [a, b] : [b, a]
        expect(at(limit, high)).toBeGreaterThanOrEqual(at(limit, low))
        expect(at(limit, low)).toBeGreaterThanOrEqual(3.6)
      }),
    )
  })
})
