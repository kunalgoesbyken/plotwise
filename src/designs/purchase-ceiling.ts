import type { FarPurchase } from '@/rules'
import { purchaseUse, withEveryPurchase, type Solution } from '@/solve'
import { designs, type Design } from './designs'
import { headline } from './headline'
import { AREA_TOLERANCE_SQM } from './tolerance'

export type Ceiling = { readonly gfaSqm: number; readonly purchases: readonly FarPurchase['kind'][] }

export type Purchased = { readonly solution: Solution; readonly design: Design; readonly purchases: readonly FarPurchase['kind'][] }

export function purchasedCeiling(solution: Solution, options: readonly Design[]): Purchased | null {
  if (!solution.limits.farPurchase.options.some((option) => option.maxExtraGfaSqm > 0)) return null
  const bought = withEveryPurchase(solution)
  const [best, top] = [headline(options), headline(designs(bought))]
  if (!top || top.metrics.gfaSqm - (best?.metrics.gfaSqm ?? 0) <= AREA_TOLERANCE_SQM) return null
  const used = purchaseUse(bought.limits, top.metrics.gfaSqm).filter((use) => use.usedGfaSqm > 0)
  return { solution: bought, design: top, purchases: used.map((use) => use.kind) }
}

export function purchaseCeiling(solution: Solution, options: readonly Design[]): Ceiling | null {
  const purchased = purchasedCeiling(solution, options)
  return purchased && { gfaSqm: purchased.design.metrics.gfaSqm, purchases: purchased.purchases }
}
