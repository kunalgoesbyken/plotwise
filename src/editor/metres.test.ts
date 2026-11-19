import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import { ASSUMPTIONS } from '@/solve/assumptions'
import { parseMetres } from './metres'

describe('parseMetres', () => {
  it('reads plain and comma decimals', () => {
    expect(parseMetres('16')).toBe(16)
    expect(parseMetres(' 6.5 ')).toBe(6.5)
    expect(parseMetres('6,5')).toBe(6.5)
  })

  it('rejects empty, zero, negative and non-numeric input', () => {
    for (const text of ['', '  ', '0', '-3', 'abc', '1e999', '12m', 'NaN', 'Infinity', '1000000000000']) expect(parseMetres(text)).toBeNull()
  })

  it('accepts every positive width up to the widest road', () => {
    fc.assert(
      fc.property(fc.double({ min: 0.01, max: ASSUMPTIONS.maxRoadWidthM.value, noNaN: true }), (n) => {
        expect(parseMetres(String(n))).toBe(n)
      }),
    )
  })
})
