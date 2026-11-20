import { LOCALE } from '@/text/messages'

const COMPACT = new Map<string, Intl.NumberFormat>()

function compactFormat(currency: string): Intl.NumberFormat {
  const cached = COMPACT.get(currency)
  if (cached) return cached
  const format = new Intl.NumberFormat(LOCALE, { style: 'currency', currency, currencyDisplay: 'narrowSymbol', notation: 'compact' })
  COMPACT.set(currency, format)
  return format
}

export const formatMoney = (value: number, currency: string) => compactFormat(currency).format(value)
