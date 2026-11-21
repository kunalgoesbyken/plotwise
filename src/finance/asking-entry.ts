import { readNumber } from '@/text/read-number'
import { isAskingPrice } from './asking-price'

export type AskingBasis = { readonly kind: 'total' } | { readonly kind: 'perLandUnit'; readonly landUnits: number }

export type AskingEntry = { readonly kind: 'blank' } | { readonly kind: 'price'; readonly price: number } | { readonly kind: 'invalid'; readonly comma: boolean }

const totalOf = (entered: number, basis: AskingBasis) => (basis.kind === 'total' ? entered : entered * basis.landUnits)

export const shownAsking = (total: number, basis: AskingBasis) => (basis.kind === 'total' ? total : total / basis.landUnits)

export function readAsking(text: string, basis: AskingBasis): AskingEntry {
  const read = readNumber(text)
  if (read.kind === 'blank') return read
  if (read.kind === 'unreadable') return { kind: 'invalid', comma: read.reason === 'comma' }
  const price = totalOf(read.value, basis)
  return isAskingPrice(price) ? { kind: 'price', price } : { kind: 'invalid', comma: false }
}
