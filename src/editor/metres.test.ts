import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import { MAX_ROAD_WIDTH_M } from '@/plot/plot'
import { hasDecimalComma, parseMetres } from './metres'

describe('parseMetres', () => {
  it('reads plain decimals and refuses a decimal comma instead of guessing it', () => {
    expect(parseMetres('16')).toBe(16)
    expect(parseMetres(' 6.5 ')).toBe(6.5)
    for (const text of ['6,5', '12,75', ',5']) {
      expect(parseMetres(text)).toBeNull()
      expect(hasDecimalComma(text)).toBe(true)
    }
    expect(hasDecimalComma('6.5')).toBe(false)
  })

  it('rejects empty, zero, negative and non-numeric input', () => {
    for (const text of ['', '  ', '0', '-3', 'abc', '1e999', '12m', 'NaN', 'Infinity', '1000000000000']) expect(parseMetres(text)).toBeNull()
  })

  it('accepts every positive width up to the widest road', () => {
    fc.assert(
      fc.property(fc.double({ min: 0.01, max: MAX_ROAD_WIDTH_M, noNaN: true }), (n) => {
        expect(parseMetres(String(n))).toBe(n)
      }),
    )
  })
})
