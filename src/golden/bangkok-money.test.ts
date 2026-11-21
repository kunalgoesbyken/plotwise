import { describe, expect, it } from 'bun:test'
import { designs } from '@/designs'
import { estimate, financeSite, moneySiteOf } from '@/finance/estimate'
import { sourcedValues } from '@/finance/values'
import { loadPack } from '@/rules'
import { MONEY_REGIONS, packInterpretations, solve } from '@/solve'
import { SCENARIOS } from './scenarios'

const pack = loadPack('bkk-y9')
const readings = packInterpretations(pack)
const region = MONEY_REGIONS.bkk

describe('Bangkok money estimates stay byte-identical across engine refactors', () => {
  for (const { name, plot, farMode } of SCENARIOS) {
    it(name, () => {
      const solution = solve(plot, pack, readings, { mode: farMode })
      const site = financeSite(solution, region)
      const values = sourcedValues(region, moneySiteOf(site, region))
      const estimates = designs(solution).map((design) => ({ id: design.id, ...estimate(design.metrics, site, values) }))
      expect(estimates.map((e) => e.purchaseCost)).toEqual(estimates.map(() => 0))
      expect(estimates.map(({ purchaseCost, ...rest }) => (purchaseCost === 0 ? rest : null))).toMatchSnapshot()
    })
  }
})
