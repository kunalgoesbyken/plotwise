import { z } from 'zod'
import type { Range } from './estimate'

export const MAX_ASKING_PRICE = 1_000_000_000_000

const AskingPriceSchema = z.number().positive().max(MAX_ASKING_PRICE)

export const isAskingPrice = (value: number) => AskingPriceSchema.safeParse(value).success

export type Verdict =
  | { readonly kind: 'below'; readonly margin: number }
  | { readonly kind: 'within' }
  | { readonly kind: 'above'; readonly margin: number }
  | { readonly kind: 'unavailable' }

export function askingVerdict(asking: number, supported: Range | null): Verdict {
  if (!supported) return { kind: 'unavailable' }
  if (asking < supported.low) return { kind: 'below', margin: supported.low - asking }
  if (asking > supported.high) return { kind: 'above', margin: asking - supported.high }
  return { kind: 'within' }
}
