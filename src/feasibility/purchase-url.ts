import type { FarPurchase } from '@/rules'
import { ASSUMPTIONS, type PurchaseRatios } from '@/solve'

const LIST = ';'
const PAIR = ':'

const KEYS: Readonly<Record<FarPurchase['kind'], string>> = { premium: 'premium', transferableRights: 'tdr', fungible: 'fungible' }

const KINDS = new Map(Object.entries(KEYS).map(([kind, key]) => [key, kind as FarPurchase['kind']]))

const isRatio = (value: number) => Number.isFinite(value) && value >= 0 && value <= ASSUMPTIONS.plotMaxFar.value

export function encodePurchase(ratios: PurchaseRatios): string | null {
  const pairs = Object.entries(ratios).flatMap(([kind, ratio]) => (ratio ? [`${KEYS[kind as FarPurchase['kind']]}${PAIR}${ratio}`] : []))
  return pairs.length === 0 ? null : pairs.join(LIST)
}

export function decodePurchase(encoded: string | null): PurchaseRatios {
  if (encoded === null) return {}
  const pairs = encoded.split(LIST).map((pair) => pair.split(PAIR))
  const entries = pairs.map(([key, text]) => [KINDS.get(key), text?.trim() === '' ? Number.NaN : Number(text)] as const)
  const kinds = entries.map(([kind]) => kind)
  const valid = pairs.every((pair) => pair.length === 2) && entries.every(([kind, value]) => kind && isRatio(value)) && new Set(kinds).size === kinds.length
  return valid ? Object.fromEntries(entries) : {}
}
