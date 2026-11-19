import type { Comparator } from '@/rules'
import { LOCALE, t } from './messages'

export type Quantity = 'm' | 'sqm' | 'percent' | 'ratio' | 'count'

const NUMBER_FORMATS: Readonly<Record<Quantity, Intl.NumberFormat>> = {
  m: new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 }),
  sqm: new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 }),
  percent: new Intl.NumberFormat(LOCALE, { style: 'percent', maximumFractionDigits: 1 }),
  ratio: new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 }),
  count: new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 }),
}

const LIST_FORMAT = new Intl.ListFormat(LOCALE, { type: 'conjunction' })

const COMPARATORS: Readonly<Record<Comparator, string>> = { lt: '<', lte: '≤', gt: '>', gte: '≥' }

export function formatNumber(value: number, quantity: Quantity): string {
  return NUMBER_FORMATS[quantity].format(value)
}

export function formatQuantity(value: number, quantity: Quantity): string {
  const number = formatNumber(value, quantity)
  switch (quantity) {
    case 'm':
      return t('unit.m', { number })
    case 'sqm':
      return t('unit.sqm', { number })
    default:
      return number
  }
}

export const formatComparator = (cmp: Comparator) => COMPARATORS[cmp]

export const formatList = (items: readonly string[]) => LIST_FORMAT.format(items)
