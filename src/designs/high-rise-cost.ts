import { withoutHighRiseRules, type Solution } from '@/solve'
import { AREA_TOLERANCE_SQM, designs, type Design } from './designs'
import { headline } from './headline'

export function highRiseCost(solution: Solution, options: readonly Design[]): number | null {
  const best = headline(options)
  if (best?.limitedBy !== 'building-class') return null
  const waived = headline(designs(withoutHighRiseRules(solution)))
  const costSqm = (waived?.metrics.gfaSqm ?? 0) - best.metrics.gfaSqm
  return costSqm > AREA_TOLERANCE_SQM ? costSqm : null
}
