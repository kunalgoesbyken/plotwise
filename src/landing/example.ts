import { EXAMPLE_FRAGMENT } from '@/editor/plot-url'
import { feasibility, PACK } from '@/feasibility/compute'
import { firstCostRange } from '@/finance/figures'
import { estimate, financeSite } from '@/finance/estimate'
import { resolveValues } from '@/finance/values'
import { EXAMPLE_PLOT } from '@/plot/example-plot'
import { REGION } from '@/region/regions'
import { MONEY_REGIONS } from '@/solve'

export const EXAMPLE_LINK = `/app#${EXAMPLE_FRAGMENT}`

const CITED_CHECKS = 3

export function exampleFigures() {
  const result = feasibility(EXAMPLE_PLOT)
  if (result.status !== 'ready') throw new Error(`The example plot no longer solves: ${result.reason}`)
  const { solution, designs } = result
  const [design] = designs
  const region = MONEY_REGIONS[REGION.id]
  const money = estimate(design.metrics, financeSite(solution, region), resolveValues(region, EXAMPLE_PLOT.buildingType, {}))
  const cited = design.checks
    .filter((check) => check.status === 'pass' && check.cites.length > 0)
    .slice(0, CITED_CHECKS)
    .map((check) => ({ id: check.id, cite: check.cites[0], source: PACK.sources[check.cites[0].source]?.name ?? check.cites[0].source }))
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
