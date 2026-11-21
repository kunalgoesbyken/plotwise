import { withoutHighRiseRules, type Solution } from '@/solve'
import { designs, type Design, type Limiter } from './designs'
import { headline } from './headline'
import { AREA_TOLERANCE_SQM } from './tolerance'

type OtherLimiter = Exclude<Limiter, 'far' | 'building-class'>

export type Loss<L extends Limiter = Exclude<Limiter, 'far'>> = { readonly limitedBy: L; readonly sqm: number }

export type Losses = readonly [Loss] | readonly [Loss<OtherLimiter>, Loss<'building-class'>]

export type CapFigures =
  | { readonly kind: 'reached'; readonly capSqm: number }
  | { readonly kind: 'legal'; readonly capSqm: number }
  | { readonly kind: 'short'; readonly capSqm: number; readonly losses: Losses; readonly buildableSqm: number }

const isOther = (limiter: Limiter): limiter is OtherLimiter => limiter !== 'far' && limiter !== 'building-class'

const withoutClass = (solution: Solution, best: Design) =>
  best.limitedBy === 'building-class' ? (headline(designs(withoutHighRiseRules(solution))) ?? best) : best

function losses(capSqm: number, free: Design, best: Design): Losses {
  const [freeSqm, buildableSqm] = [free.metrics.gfaSqm, best.metrics.gfaSqm]
  if (!isOther(free.limitedBy)) return [{ limitedBy: 'building-class', sqm: capSqm - buildableSqm }]
  if (freeSqm - buildableSqm <= AREA_TOLERANCE_SQM) return [{ limitedBy: free.limitedBy, sqm: capSqm - buildableSqm }]
  return [
    { limitedBy: free.limitedBy, sqm: capSqm - freeSqm },
    { limitedBy: 'building-class', sqm: freeSqm - buildableSqm },
  ]
}

export function capBreakdown(solution: Solution, options: readonly Design[]): CapFigures | null {
  const best = headline(options)
  if (!best) return null
  const capSqm = solution.farCap.maxGfaSqm
  if (best.limitedBy === 'far') return { kind: 'reached', capSqm }
  return { kind: 'short', capSqm, losses: losses(capSqm, withoutClass(solution, best), best), buildableSqm: best.metrics.gfaSqm }
}

export const capOf = (design: Design, { farCap }: Solution): CapFigures => ({ kind: design.limitedBy === 'far' ? 'reached' : 'legal', capSqm: farCap.maxGfaSqm })
