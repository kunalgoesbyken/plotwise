import { describe, expect, it } from 'bun:test'
import { parseLengthM, parsePositiveNumber } from './length'

describe('parseLengthM', () => {
  it.each([
    ['12', 12],
    ['12 m', 12],
    ['12.5m', 12.5],
    ['12,5', 12.5],
    ['  7  ', 7],
    ['12 M', 12],
    ['12 meters', 12],
    ['40 ft', 12.192],
    ['40ft', 12.192],
    ['40 feet', 12.192],
    ["40'", 12.192],
    ['10\'6"', 3.2004],
    ['๑๒', 12],
    ['๑๒.๕ m', 12.5],
  ])('parses %p as %p metres', (text, expected) => {
    expect(parseLengthM(text)).toBeCloseTo(expected, 4)
  })

  it.each([undefined, '', 'tall', '12 stories', '12-15', '12;15', '~12', '-3', '0', '1e3', '12 m 5', '٣', '12 constructor'])(
    'returns undefined for %p',
    (text) => {
      expect(parseLengthM(text)).toBeUndefined()
    },
  )
})

describe('parsePositiveNumber', () => {
  it.each([
    ['5', 5],
    ['5.5', 5.5],
    ['๓', 3],
  ])('parses %p as %p', (text, expected) => {
    expect(parsePositiveNumber(text)).toBe(expected)
  })

  it.each([undefined, '', '0', '-1', '5;6', 'five', '5 m'])('returns undefined for %p', (text) => {
    expect(parsePositiveNumber(text)).toBeUndefined()
  })
})
