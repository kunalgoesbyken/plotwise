import { describe, expect, it } from 'bun:test'
import { designs } from '@/designs'
import { basisOf, estimate, financeSite } from '@/finance/estimate'
import { resolveValues } from '@/finance/values'
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
      const values = resolveValues(region.prices, basisOf(site, region.prices), {})
      expect(designs(solution).map((design) => ({ id: design.id, ...estimate(design.metrics, site, values) }))).toMatchSnapshot()
    })
  }
})
