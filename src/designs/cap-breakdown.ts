import { withoutHighRiseRules, type Solution } from '@/solve'
import { areaFromDisplay, areaToDisplay, type AreaUnit } from '@/units/area'
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

const asShown = (sqm: number, unit: AreaUnit) => areaFromDisplay(Math.round(areaToDisplay(sqm, unit)), unit)

function losses(capSqm: number, free: Design, best: Design, unit: AreaUnit): Losses {
  const buildableSqm = asShown(best.metrics.gfaSqm, unit)
  const freeSqm = asShown(free.metrics.gfaSqm, unit)
  if (!isOther(free.limitedBy)) return [{ limitedBy: 'building-class', sqm: capSqm - buildableSqm }]
  if (free.metrics.gfaSqm - best.metrics.gfaSqm <= AREA_TOLERANCE_SQM) return [{ limitedBy: free.limitedBy, sqm: capSqm - buildableSqm }]
  return [
    { limitedBy: free.limitedBy, sqm: capSqm - freeSqm },
    { limitedBy: 'building-class', sqm: freeSqm - buildableSqm },
  ]
}

export function capBreakdown(solution: Solution, options: readonly Design[], unit: AreaUnit): CapFigures | null {
  const best = headline(options)
  if (!best) return null
  if (best.limitedBy === 'far') return { kind: 'reached', capSqm: solution.farCap.maxGfaSqm }
  const [capSqm, buildableSqm] = [asShown(solution.farCap.maxGfaSqm, unit), asShown(best.metrics.gfaSqm, unit)]
  return { kind: 'short', capSqm, losses: losses(capSqm, withoutClass(solution, best), best, unit), buildableSqm }
}

export const capOf = (design: Design, { farCap }: Solution): CapFigures => ({ kind: design.limitedBy === 'far' ? 'reached' : 'legal', capSqm: farCap.maxGfaSqm })
