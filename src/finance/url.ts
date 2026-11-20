import type { MoneyRegion } from '@/solve'
import { isAskingPrice } from './asking-price'
import { isValidValue, STORAGE_KEYS } from './parameters'
import type { Overrides } from './values'

const LIST = ';'
const PAIR = ':'
const VERSION = `v${PAIR}2`

function strictNumber(text: string) {
  return text.trim() === '' ? Number.NaN : Number(text)
}

export function encodeAssumptions(overrides: Overrides): string | null {
  const pairs = Object.entries(overrides).map(([key, value]) => `${key}${PAIR}${value}`)
  return pairs.length === 0 ? null : [VERSION, ...pairs].join(LIST)
}

const landPriceScale = (pairs: readonly string[], { landUnit, oldLinkLandUnitSqm }: MoneyRegion) =>
  oldLinkLandUnitSqm === null || pairs.includes(VERSION) ? 1 : landUnit.sqm.value / oldLinkLandUnitSqm.value

export function decodeAssumptions(encoded: string | null, region: MoneyRegion): Overrides {
  if (encoded === null) return {}
  const pairs = encoded.split(LIST)
  const landScale = landPriceScale(pairs, region)
  const entries = pairs.flatMap((pair) => {
    const [key, text] = pair.split(PAIR)
    const parameter = STORAGE_KEYS.get(key)
    if (!parameter) return []
    const value = strictNumber(text ?? '') * (parameter.unit === 'landMoney' ? landScale : 1)
    return isValidValue(parameter, value) ? [[key, value] as const] : []
  })
  return Object.fromEntries(entries)
}

export const encodeAskingPrice = (price: number | null) => (price === null ? null : String(price))

export function decodeAskingPrice(encoded: string | null): number | null {
  if (encoded === null) return null
  const price = strictNumber(encoded)
  return isAskingPrice(price) ? price : null
}
