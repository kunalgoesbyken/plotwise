import { EXAMPLE_FRAGMENT } from '@/editor/plot-url'
import { feasibility, PACK } from '@/feasibility/compute'
import { firstCostRange } from '@/finance/figures'
import { basisOf, estimate, financeSite } from '@/finance/estimate'
import { resolveValues } from '@/finance/values'
import { EXAMPLE_PLOT } from '@/plot/example-plot'
import { REGION } from '@/region/regions'
import { isSourceCite } from '@/rules'
import { MONEY_REGIONS } from '@/solve'

export const EXAMPLE_LINK = `/app#${EXAMPLE_FRAGMENT}`

const CITED_CHECKS = 3

export function exampleFigures() {
  const result = feasibility(EXAMPLE_PLOT)
  if (result.status !== 'ready') throw new Error(`The example plot no longer solves: ${result.reason}`)
  const { solution, designs } = result
  const [design] = designs
  const region = MONEY_REGIONS[REGION.id]
  const site = financeSite(solution, region)
  const money = estimate(design.metrics, site, resolveValues(region, basisOf(site), {}))
  const cited = design.checks
    .filter((check) => check.status === 'pass')
    .flatMap((check) => {
      const cite = check.cites.find(isSourceCite)
      return cite ? [{ id: check.id, cite, source: PACK.sources[cite.source]?.name ?? cite.source }] : []
    })
    .slice(0, CITED_CHECKS)
  const toCheck = [...new Set(designs.flatMap((d) => d.checks.filter((check) => check.status === 'manual').map((check) => check.id)))]
  return {
    plotSqm: solution.site.areaSqm,
    allowedSqm: solution.farCap.maxGfaSqm,
    currency: region.currency,
    firstCost: firstCostRange(money),
    landValue: money.landValue,
    cited,
    toCheck,
  }
}
