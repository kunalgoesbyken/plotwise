export type ReadNumber =
  | { readonly kind: 'blank' }
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'unreadable'; readonly reason: 'comma' | 'not-a-number' }

const PLAIN = /^(\d+\.?\d*|\.\d+)$/
const THOUSANDS_GROUPED = /^\d{1,3}(,\d{3})+(\.\d*)?$/

export function readNumber(text: string): ReadNumber {
  const trimmed = text.trim()
  if (trimmed === '') return { kind: 'blank' }
  const grouped = THOUSANDS_GROUPED.test(trimmed)
  if (trimmed.includes(',') && !grouped) return { kind: 'unreadable', reason: 'comma' }
  const value = Number(trimmed.replaceAll(',', ''))
  if (!(grouped || PLAIN.test(trimmed)) || !Number.isFinite(value)) return { kind: 'unreadable', reason: 'not-a-number' }
  return { kind: 'number', value }
}
