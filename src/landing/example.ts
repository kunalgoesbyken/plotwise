import { headline, highRiseCost } from '@/designs'
import { exampleFragment } from '@/editor/plot-url'
import { capFigures } from '@/feasibility/cap-line'
import { feasibility } from '@/feasibility/compute'
import { firstCostRange } from '@/finance/figures'
import { estimate, financeSite, moneySiteOf } from '@/finance/estimate'
import { sourcedValues } from '@/finance/values'
import { EXAMPLE_PLOT } from '@/plot/example-plot'
import { DEFAULT_REGION, REGIONS } from '@/region/regions'
import { isSourceCite, loadPack } from '@/rules'
import { MONEY_REGIONS, type RegionId } from '@/solve'
import { APP_PATH } from './links'

const exampleLink = (region: RegionId) => `${APP_PATH}#${exampleFragment(region)}`

export const EXAMPLE_LINK = exampleLink(DEFAULT_REGION.id)

export const OTHER_EXAMPLES = Object.values(REGIONS)
  .filter((region) => region.example && region.id !== DEFAULT_REGION.id)
  .map(({ id, name }) => ({ name, link: exampleLink(id) }))

const CITED_CHECKS = 3

export type ExampleFigures = ReturnType<typeof exampleFigures>

export function exampleFigures() {
  const pack = loadPack(DEFAULT_REGION.packId)
  const result = feasibility(EXAMPLE_PLOT, pack)
  if (result.status !== 'ready') throw new Error(`The example plot no longer solves: ${result.reason}`)
  const { solution, designs } = result
  const design = headline(designs)
  if (!design) throw new Error('The example plot no longer has a design')
  const region = MONEY_REGIONS[DEFAULT_REGION.id]
  const site = financeSite(solution, region)
  const money = estimate(design.metrics, site, sourcedValues(region, moneySiteOf(site, region)))
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
    buildableSqm: design.metrics.gfaSqm,
    designName: design.name,
    cap: capFigures(design, solution, highRiseCost(solution, designs)),
    currency: region.currency,
    firstCost: firstCostRange(money),
    landValue: money.landValue,
    cited,
    toCheck,
  }
}
