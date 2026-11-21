import { designs, headline, purchasedCeiling } from '@/designs'
import type { FarPurchase } from '@/rules'
import { withNoPurchase, type MoneyRegion, type Solution } from '@/solve'
import { estimate, financeSite, needsBasement, neededPrices, type Range } from './estimate'
import { PURCHASE_PRICES, type Input, type PurchasePriceId } from './parameters'
import type { Values } from './values'

export type PurchaseWorth = {
  readonly purchases: readonly FarPurchase['kind'][]
  readonly cost: number
  readonly landValueChange: Range
  readonly verdict: 'worth' | 'not-worth' | 'depends'
}

function verdictOf({ low, high }: Range): PurchaseWorth['verdict'] {
  if (low > 0) return 'worth'
  return high <= 0 ? 'not-worth' : 'depends'
}

type Pricing = {
  readonly region: MoneyRegion
  readonly values: Values
  readonly priceOf: (input: Input) => number | null
  readonly basementUnrated: boolean
}

export function purchaseWorth(solution: Solution, { region, values, priceOf, basementUnrated }: Pricing): PurchaseWorth | null {
  const unbought = withNoPurchase(solution)
  const options = designs(unbought)
  const baseline = headline(options)
  const ceiling = purchasedCeiling(unbought, options)
  if (!baseline || !ceiling) return null
  if (basementUnrated && needsBasement([baseline.metrics, ceiling.design.metrics], values.parkingLevels)) return null
  const boughtSite = financeSite(ceiling.solution, region)
  const prices: Partial<Record<PurchasePriceId, number>> = {}
  for (const id of neededPrices(boughtSite)) {
    const price = priceOf(PURCHASE_PRICES[id])
    if (price === null) return null
    prices[id] = price
  }
  const before = estimate(baseline.metrics, financeSite(unbought, region), values)
  const after = estimate(ceiling.design.metrics, boughtSite, values, prices)
  const landValueChange = { low: after.landValue.low - before.landValue.low, high: after.landValue.high - before.landValue.high }
  return { purchases: ceiling.purchases, cost: after.purchaseCost, landValueChange, verdict: verdictOf(landValueChange) }
}
