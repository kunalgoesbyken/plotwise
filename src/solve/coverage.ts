import type { PlotLimits } from '@/plot/plot'
import { enteredCite, type Cite, type RulePack } from '@/rules'
import { SolveError } from './errors'

export type CoverageLimit = {
  readonly share: number
  readonly maxFootprintSqm: number
  readonly cites: readonly Cite[]
}

export function coverageLimit(pack: RulePack, plotLimits: PlotLimits | undefined, areaSqm: number): CoverageLimit | null {
  const { coverage } = pack
  if (!coverage) return null
  if (coverage.kind === 'maxShare') {
    return { share: coverage.share.value, maxFootprintSqm: coverage.share.value * areaSqm, cites: [coverage.share.cite, ...coverage.notes] }
  }
  const share = plotLimits?.maxCoverageShare
  if (share === undefined) throw new SolveError('plot-limit-missing', ['maxCoverageShare'])
  return { share, maxFootprintSqm: share * areaSqm, cites: [enteredCite('maxCoverageShare')] }
}
