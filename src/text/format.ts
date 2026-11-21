import type { Comparator, Range } from '@/rules'
import { areaToDisplay, type AreaUnit } from '@/units/area'
import { LOCALE, t } from './messages'

export type Quantity = 'm' | 'km' | AreaUnit | 'percent' | 'ratio' | 'count' | 'plain'

const NUMBER_FORMATS: Readonly<Record<Quantity, Intl.NumberFormat>> = {
  m: new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 }),
  km: new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 }),
  sqm: new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 }),
  sqft: new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 }),
  percent: new Intl.NumberFormat(LOCALE, { style: 'percent', maximumFractionDigits: 1 }),
  ratio: new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 }),
  count: new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 }),
  plain: new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2, useGrouping: false }),
}

const LIST_FORMAT = new Intl.ListFormat(LOCALE, { type: 'conjunction' })

const ALTERNATIVES_FORMAT = new Intl.ListFormat(LOCALE, { type: 'disjunction' })

const DATE_FORMAT = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', timeZone: 'UTC' })

const COMPARATORS: Readonly<Record<Comparator, string>> = { lt: '<', lte: '≤', gt: '>', gte: '≥' }

export function formatNumber(value: number, quantity: Quantity): string {
  return NUMBER_FORMATS[quantity].format(quantity === 'sqft' ? areaToDisplay(value, quantity) : value)
}

export function formatQuantity(value: number, quantity: Quantity): string {
  const number = formatNumber(value, quantity)
  switch (quantity) {
    case 'm':
      return t('unit.m', { number })
    case 'sqm':
      return t('unit.sqm', { number })
    case 'sqft':
      return t('unit.sqft', { number })
    default:
      return number
  }
}

export const formatComparator = (cmp: Comparator) => COMPARATORS[cmp]

export const formatBound = ({ cmp, value }: { readonly cmp: Comparator; readonly value: number }, quantity: Quantity) =>
  `${formatComparator(cmp)} ${formatQuantity(value, quantity)}`

export function formatRange({ min, max }: Range, quantity: Quantity): string {
  if (min && max) return t('range.between', { min: formatBound(min, quantity), max: formatBound(max, quantity) })
  const only = min ?? max
  return only ? formatBound(only, quantity) : t('range.any')
}

export const formatList = (items: readonly string[]) => LIST_FORMAT.format(items)

export const formatAlternatives = (items: readonly string[]) => ALTERNATIVES_FORMAT.format(items)

export const formatDate = (isoDateTime: string) => DATE_FORMAT.format(new Date(isoDateTime))
