import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import { parseMetres } from './metres'

describe('parseMetres', () => {
  it('reads plain and comma decimals', () => {
    expect(parseMetres('16')).toBe(16)
    expect(parseMetres(' 6.5 ')).toBe(6.5)
    expect(parseMetres('6,5')).toBe(6.5)
  })

  it('rejects empty, zero, negative and non-numeric input', () => {
    for (const text of ['', '  ', '0', '-3', 'abc', '1e999', '12m', 'NaN', 'Infinity']) expect(parseMetres(text)).toBeNull()
  })

  it('accepts every positive finite number written as text', () => {
    fc.assert(
      fc.property(fc.double({ min: 0.01, max: 1000, noNaN: true }), (n) => {
        expect(parseMetres(String(n))).toBe(n)
      }),
    )
  })
})
