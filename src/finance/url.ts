import { isValidValue, STORAGE_KEYS } from './parameters'
import type { Overrides } from './values'

const LIST = ';'
const PAIR = ':'

function strictNumber(text: string) {
  return text.trim() === '' ? Number.NaN : Number(text)
}

export function encodeAssumptions(overrides: Overrides): string | null {
  const pairs = Object.entries(overrides).map(([key, value]) => `${key}${PAIR}${value}`)
  return pairs.length === 0 ? null : pairs.join(LIST)
}

export function decodeAssumptions(encoded: string | null): Overrides {
  if (encoded === null) return {}
  const entries = encoded.split(LIST).flatMap((pair) => {
    const [key, text] = pair.split(PAIR)
    const parameter = STORAGE_KEYS.get(key)
    const value = strictNumber(text ?? '')
    return parameter && isValidValue(parameter, value) ? [[key, value] as const] : []
  })
  return Object.fromEntries(entries)
}
