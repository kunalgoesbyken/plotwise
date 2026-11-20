import type { Bound, Range } from './cite'

export const meets = (upper: Bound, lower: Bound) =>
  upper.value === lower.value && ((upper.cmp === 'lt' && lower.cmp === 'gte') || (upper.cmp === 'lte' && lower.cmp === 'gt'))

export function bandGaps(ranges: readonly Range[]): string[] {
  const errors = ranges[0]?.min ? ['does not start at 0'] : []
  ranges.slice(1).forEach((range, i) => {
    const previous = ranges[i]
    if (!previous.max || !range.min || !meets(previous.max, range.min)) errors.push(`has a gap or overlap between bands ${i} and ${i + 1}`)
  })
  return errors
}

export const endsOpen = (ranges: readonly Range[]) => ranges.length > 0 && ranges[ranges.length - 1].max === undefined

export const bandsCoverEverything = (ranges: readonly Range[]) => bandGaps(ranges).length === 0 && endsOpen(ranges)
