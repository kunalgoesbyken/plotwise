import { LOCALE } from '@/text/messages'

const COMPACT = new Map<string | null, Intl.NumberFormat>()

const formatOptions = (currency: string | null): Intl.NumberFormatOptions =>
  currency === null ? { notation: 'compact' } : { style: 'currency', currency, currencyDisplay: 'narrowSymbol', notation: 'compact' }

function compactFormat(currency: string | null): Intl.NumberFormat {
  const cached = COMPACT.get(currency)
  if (cached) return cached
  const format = new Intl.NumberFormat(LOCALE, formatOptions(currency))
  COMPACT.set(currency, format)
  return format
}

export const formatMoney = (value: number, currency: string | null) => compactFormat(currency).format(value)
