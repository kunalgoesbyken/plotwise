import { isValidValue, STORAGE_KEYS } from './parameters'
import type { Overrides } from './values'

const PARAM = 'assume'
const LIST = ';'
const PAIR = ':'

function strictNumber(text: string) {
  return text.trim() === '' ? Number.NaN : Number(text)
}

export function encodeAssumptions(overrides: Overrides): string {
  const pairs = Object.entries(overrides).map(([key, value]) => `${key}${PAIR}${value}`)
  return pairs.length === 0 ? '' : new URLSearchParams({ [PARAM]: pairs.join(LIST) }).toString()
}

export function decodeAssumptions(fragment: string): Overrides {
  const encoded = new URLSearchParams(fragment.replace(/^#/, '')).get(PARAM)
  if (encoded === null) return {}
  const entries = encoded.split(LIST).flatMap((pair) => {
    const [key, text] = pair.split(PAIR)
    const parameter = STORAGE_KEYS.get(key)
    const value = strictNumber(text ?? '')
    return parameter && isValidValue(parameter, value) ? [[key, value] as const] : []
  })
  return Object.fromEntries(entries)
}
