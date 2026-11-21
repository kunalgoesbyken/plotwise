import { z } from 'zod'
import type { MoneyRegion } from '@/solve'
import { isAskingPrice } from './asking-price'
import { isValidValue, STORAGE_KEYS } from './parameters'
import type { Overrides } from './values'

const LIST = ';'
const PAIR = ':'
const VERSION = `v${PAIR}2`
const EXAMPLES = 'examples'
const EXAMPLES_ON = '1'
const EXAMPLES_OFF = '0'

const ExamplesSchema = z.enum([EXAMPLES_ON, EXAMPLES_OFF])

export type ExampleChoice = boolean | null

export type AssumptionsState = { readonly overrides: Overrides; readonly examples: ExampleChoice }

function strictNumber(text: string) {
  return text.trim() === '' ? Number.NaN : Number(text)
}

const examplesPair = (examples: ExampleChoice) => (examples === null ? [] : [`${EXAMPLES}${PAIR}${examples ? EXAMPLES_ON : EXAMPLES_OFF}`])

export function encodeAssumptions(overrides: Overrides, examples: ExampleChoice = null): string | null {
  const pairs = [...examplesPair(examples), ...Object.entries(overrides).map(([key, value]) => `${key}${PAIR}${value}`)]
  return pairs.length === 0 ? null : [VERSION, ...pairs].join(LIST)
}

const landPriceScale = (pairs: readonly string[], { landUnit, oldLinkLandUnitSqm }: MoneyRegion) =>
  oldLinkLandUnitSqm === null || pairs.includes(VERSION) ? 1 : landUnit.sqm.value / oldLinkLandUnitSqm.value

function decodeExamples(pairs: readonly string[]): ExampleChoice {
  const given = pairs.flatMap((pair) => {
    const [key, text] = pair.split(PAIR)
    return key === EXAMPLES ? [ExamplesSchema.safeParse(text)] : []
  })
  const [only] = given
  return given.length === 1 && only.success ? only.data === EXAMPLES_ON : null
}

function decodeOverrides(pairs: readonly string[], region: MoneyRegion): Overrides {
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

const NOTHING_SET: AssumptionsState = { overrides: {}, examples: null }

export function decodeAssumptions(encoded: string | null, region: MoneyRegion): AssumptionsState {
  if (encoded === null) return NOTHING_SET
  const pairs = encoded.split(LIST)
  return { overrides: decodeOverrides(pairs, region), examples: decodeExamples(pairs) }
}

export const encodeAskingPrice = (price: number | null) => (price === null ? null : String(price))

export function decodeAskingPrice(encoded: string | null): number | null {
  if (encoded === null) return null
  const price = strictNumber(encoded)
  return isAskingPrice(price) ? price : null
}
