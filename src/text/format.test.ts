import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import { formatComparator, formatList, formatNumber, formatQuantity } from './format'

describe('formatQuantity', () => {
  it('writes metres to one decimal and square metres as whole numbers with grouping', () => {
    expect(formatQuantity(12.25, 'm')).toBe('12.3\u00a0m')
    expect(formatQuantity(6, 'm')).toBe('6\u00a0m')
    expect(formatQuantity(19329.6, 'sqm')).toBe('19,330\u00a0m²')
  })

  it('writes shares as percentages and ratios to two decimals', () => {
    expect(formatQuantity(0.045, 'percent')).toBe('4.5%')
    expect(formatQuantity(0.5, 'percent')).toBe('50%')
    expect(formatQuantity(6.884287, 'ratio')).toBe('6.88')
    expect(formatQuantity(1234, 'count')).toBe('1,234')
  })

  it('never shows a fraction of a square metre or more than one decimal of a metre', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1e7, noNaN: true }), (value) => {
        expect(formatNumber(value, 'sqm')).not.toContain('.')
        expect(formatNumber(value, 'm')).toMatch(/^[\d,]+(\.\d)?$/)
      }),
    )
  })
})

describe('formatComparator and formatList', () => {
  it('uses the mathematical signs', () => {
    expect([formatComparator('lt'), formatComparator('lte'), formatComparator('gt'), formatComparator('gte')]).toEqual(['<', '≤', '>', '≥'])
  })

  it('joins items as an English list', () => {
    expect(formatList(['A–B'])).toBe('A–B')
    expect(formatList(['A–B', 'C–D', 'E–F'])).toBe('A–B, C–D, and E–F')
  })
})
