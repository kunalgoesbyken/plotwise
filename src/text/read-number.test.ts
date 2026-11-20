import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import { readNumber } from './read-number'

describe('reading a typed number', () => {
  it('reads plain decimals with a point', () => {
    expect(readNumber('2.5')).toEqual({ kind: 'number', value: 2.5 })
    expect(readNumber(' 12 ')).toEqual({ kind: 'number', value: 12 })
    expect(readNumber('.5')).toEqual({ kind: 'number', value: 0.5 })
    expect(readNumber('0')).toEqual({ kind: 'number', value: 0 })
  })

  it('reads commas only as whole thousands groups', () => {
    expect(readNumber('5,000')).toEqual({ kind: 'number', value: 5000 })
    expect(readNumber('1,234,567.5')).toEqual({ kind: 'number', value: 1234567.5 })
    expect(readNumber('32,291')).toEqual({ kind: 'number', value: 32291 })
  })

  it('refuses a decimal comma or any other comma instead of guessing, so 2,5 never becomes 25', () => {
    for (const text of ['2,5', '62,5', '2,50', '0,75', '1,2345', '12,5000', '1,23,456', ',5', '5,', '1,000,00']) {
      expect(readNumber(text)).toEqual({ kind: 'unreadable', reason: 'comma' })
    }
  })

  it('reads blank text as nothing entered', () => {
    for (const text of ['', '   ']) expect(readNumber(text)).toEqual({ kind: 'blank' })
  })

  it('refuses anything else that is not a number', () => {
    for (const text of ['abc', '1e999', '1e3', '-5', '0x10', '5 m', 'NaN', 'Infinity', '1.2.3', '1..2', '٢٫٥']) {
      expect(readNumber(text)).toEqual({ kind: 'unreadable', reason: 'not-a-number' })
    }
  })

  it('reads back any number written with or without thousands groups', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1e12, noNaN: true }), (value) => {
        const plain = Number(value.toFixed(4))
        const grouped = plain.toLocaleString('en-US', { maximumFractionDigits: 4, useGrouping: true })
        expect(readNumber(String(plain))).toEqual({ kind: 'number', value: plain })
        expect(readNumber(grouped)).toEqual({ kind: 'number', value: plain })
      }),
    )
  })
})
