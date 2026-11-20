import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import { askingVerdict, isAskingPrice, MAX_ASKING_PRICE } from './asking-price'

const price = fc.double({ min: 1, max: MAX_ASKING_PRICE, noNaN: true })
const landValue = fc.double({ min: -1e10, max: 1e11, noNaN: true })
const range = fc.tuple(landValue, landValue).map(([a, b]) => ({ low: Math.min(a, b), high: Math.max(a, b) }))

describe('isAskingPrice', () => {
  it('takes a positive, finite price up to the most a plot can sensibly cost', () => {
    expect(isAskingPrice(200_000_000)).toBe(true)
    expect(isAskingPrice(Number.MIN_VALUE)).toBe(true)
    expect(isAskingPrice(MAX_ASKING_PRICE)).toBe(true)
  })

  it('refuses zero, negative, endless and unreadable prices and prices above the most', () => {
    for (const value of [0, -1, -0, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, MAX_ASKING_PRICE * 1.000001]) {
      expect(isAskingPrice(value)).toBe(false)
    }
  })
})

describe('askingVerdict', () => {
  const supported = { low: 163_000_000, high: 240_000_000 }

  it('is within range at both ends of the supported range', () => {
    expect(askingVerdict(supported.low, supported)).toEqual({ kind: 'within' })
    expect(askingVerdict(supported.high, supported)).toEqual({ kind: 'within' })
    expect(askingVerdict(200_000_000, supported)).toEqual({ kind: 'within' })
  })

  it('is over by the exact amount above the high end', () => {
    expect(askingVerdict(300_000_000, supported)).toEqual({ kind: 'above', margin: 60_000_000 })
  })

  it('is under by the exact amount below the low end', () => {
    expect(askingVerdict(120_000_000, supported)).toEqual({ kind: 'below', margin: 43_000_000 })
  })

  it('cannot be given without a supported land value', () => {
    expect(askingVerdict(200_000_000, null)).toEqual({ kind: 'unavailable' })
  })

  it('is over when the land supports nothing, by the price plus what the land costs to take on', () => {
    expect(askingVerdict(200_000_000, { low: -20_000_000, high: -5_000_000 })).toEqual({ kind: 'above', margin: 205_000_000 })
  })

  it('places every price below, within or above the range, with a positive margin outside it', () => {
    fc.assert(
      fc.property(price, range, (asking, supported) => {
        const verdict = askingVerdict(asking, supported)
        switch (verdict.kind) {
          case 'below':
            return asking < supported.low && verdict.margin === supported.low - asking && verdict.margin > 0
          case 'above':
            return asking > supported.high && verdict.margin === asking - supported.high && verdict.margin > 0
          case 'within':
            return asking >= supported.low && asking <= supported.high
          case 'unavailable':
            return false
        }
      }),
    )
  })

  it('moves from within to outside just past either end', () => {
    fc.assert(
      fc.property(range.filter(({ low }) => low > 1), ({ low, high }) => {
        const supported = { low, high }
        const justBelow = low - Math.max(Number.EPSILON * low, 1)
        const justAbove = high + Math.max(Number.EPSILON * Math.abs(high), 1)
        return (
          askingVerdict(justBelow, supported).kind === 'below' &&
          askingVerdict(low, supported).kind === 'within' &&
          askingVerdict(high, supported).kind === 'within' &&
          askingVerdict(justAbove, supported).kind === 'above'
        )
      }),
    )
  })
})
