import type { Bound, Comparator, Range } from '@/rules'

const COMPARE: Readonly<Record<Comparator, (a: number, b: number) => boolean>> = {
  lt: (a, b) => a < b,
  lte: (a, b) => a <= b,
  gt: (a, b) => a > b,
  gte: (a, b) => a >= b,
}

const NEGATION: Readonly<Record<Comparator, Comparator>> = { lt: 'gte', lte: 'gt', gt: 'lte', gte: 'lt' }

export const compare = (value: number, cmp: Comparator, limit: number) => COMPARE[cmp](value, limit)

export const satisfies = (value: number, bound: Bound) => compare(value, bound.cmp, bound.value)

export const negate = (cmp: Comparator) => NEGATION[cmp]

export const inRange = (value: number, range: Range) =>
  (!range.min || satisfies(value, range.min)) && (!range.max || satisfies(value, range.max))
