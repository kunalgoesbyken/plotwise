import { encodePlot } from '@/editor/plot-url'
import { feasibility } from '@/feasibility/compute'
import { firstCostRange } from '@/finance/figures'
import { basisOf, estimate, financeSite } from '@/finance/estimate'
import { resolveValues } from '@/finance/values'
import { EXAMPLE_PLOT } from '@/plot/example-plot'
import { DEFAULT_REGION } from '@/region/regions'
import { isSourceCite, loadPack } from '@/rules'
import { MONEY_REGIONS } from '@/solve'

export const EXAMPLE_LINK = `/app#${encodePlot(EXAMPLE_PLOT)}`

const CITED_CHECKS = 3

export function exampleFigures() {
  const pack = loadPack(DEFAULT_REGION.packId)
  const result = feasibility(EXAMPLE_PLOT, pack)
  if (result.status !== 'ready') throw new Error(`The example plot no longer solves: ${result.reason}`)
  const { solution, designs } = result
  const [design] = designs
  const region = MONEY_REGIONS[DEFAULT_REGION.id]
  const site = financeSite(solution, region)
  const money = estimate(design.metrics, site, resolveValues(region.prices, basisOf(site, region.prices), {}))
  const cited = design.checks
    .filter((check) => check.status === 'pass')
    .flatMap((check) => {
      const cite = check.cites.find(isSourceCite)
      return cite ? [{ id: check.id, cite, source: pack.sources[cite.source]?.name ?? cite.source }] : []
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
