import { LOCALE } from '@/text/messages'

type Magnitude = { readonly from: number; readonly label: string }

const MAGNITUDES: Readonly<Record<string, readonly Magnitude[]>> = {
  INR: [
    { from: 10_000_000, label: 'Cr' },
    { from: 100_000, label: 'L' },
  ],
}

const COMPACT = new Map<string | null, Intl.NumberFormat>()
const SCALED = new Map<string, Intl.NumberFormat>()

const formatOptions = (currency: string | null): Intl.NumberFormatOptions =>
  currency === null ? { notation: 'compact' } : { style: 'currency', currency, currencyDisplay: 'narrowSymbol', notation: 'compact' }

function compactFormat(currency: string | null): Intl.NumberFormat {
  const cached = COMPACT.get(currency)
  if (cached) return cached
  const format = new Intl.NumberFormat(LOCALE, formatOptions(currency))
  COMPACT.set(currency, format)
  return format
}

function scaledFormat(currency: string): Intl.NumberFormat {
  const cached = SCALED.get(currency)
  if (cached) return cached
  const format = new Intl.NumberFormat(LOCALE, { style: 'currency', currency, currencyDisplay: 'narrowSymbol', maximumFractionDigits: 1, minimumFractionDigits: 0 })
  SCALED.set(currency, format)
  return format
}

const magnitudeOf = (value: number, currency: string | null) =>
  currency === null ? undefined : MAGNITUDES[currency]?.find(({ from }) => Math.abs(value) >= from)

export function formatMoney(value: number, currency: string | null): string {
  const magnitude = magnitudeOf(value, currency)
  if (currency === null || !magnitude) return compactFormat(currency).format(value)
  return `${scaledFormat(currency).format(value / magnitude.from)} ${magnitude.label}`
}

const AMOUNT = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0, maximumSignificantDigits: 2, roundingPriority: 'morePrecision' })

export const formatAmount = (value: number) => AMOUNT.format(value)
