import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import { MAX_ASKING_PRICE } from './asking-price'
import { readAsking, shownAsking, type AskingBasis } from './asking-entry'

const TOTAL: AskingBasis = { kind: 'total' }
const perLandUnit = (landUnits: number): AskingBasis => ({ kind: 'perLandUnit', landUnits })

const RAI_IN_WAH = 400

describe('reading an asking price', () => {
  it('reads a total, written with or without thousands groups, as the price', () => {
    expect(readAsking('300000000', TOTAL)).toEqual({ kind: 'price', price: 300_000_000 })
    expect(readAsking('300,000,000', TOTAL)).toEqual({ kind: 'price', price: 300_000_000 })
  })

  it('reads a price per land unit as that price times the plot’s area in land units', () => {
    expect(readAsking('250,000', perLandUnit(RAI_IN_WAH))).toEqual({ kind: 'price', price: 100_000_000 })
    expect(readAsking('1000.5', perLandUnit(2))).toEqual({ kind: 'price', price: 2001 })
  })

  it('reads blank text as no price, whatever the basis', () => {
    for (const basis of [TOTAL, perLandUnit(RAI_IN_WAH)]) expect(readAsking('  ', basis)).toEqual({ kind: 'blank' })
  })

  it('refuses a decimal comma, and says it was the comma', () => {
    expect(readAsking('2,5', TOTAL)).toEqual({ kind: 'invalid', comma: true })
  })

  it('refuses text that is not a number, zero, and a total above the most a plot can cost', () => {
    for (const text of ['abc', '-5', '0']) expect(readAsking(text, TOTAL)).toEqual({ kind: 'invalid', comma: false })
    expect(readAsking(String(MAX_ASKING_PRICE * 2), TOTAL)).toEqual({ kind: 'invalid', comma: false })
  })

  it('checks the total, not the price per land unit, against the most a plot can cost', () => {
    const perUnit = MAX_ASKING_PRICE / RAI_IN_WAH
    expect(readAsking(String(perUnit), perLandUnit(RAI_IN_WAH))).toEqual({ kind: 'price', price: MAX_ASKING_PRICE })
    expect(readAsking(String(perUnit * 2), perLandUnit(RAI_IN_WAH))).toEqual({ kind: 'invalid', comma: false })
  })

  it('shows a total as itself, and per land unit as the total over the plot’s area in land units', () => {
    expect(shownAsking(300_000_000, TOTAL)).toBe(300_000_000)
    expect(shownAsking(100_000_000, perLandUnit(RAI_IN_WAH))).toBe(250_000)
  })

  it('shows back the price per land unit it read, for any plot', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10_000_000 }), fc.double({ min: 1, max: 100_000, noNaN: true }), (perUnit, landUnits) => {
        const read = readAsking(String(perUnit), perLandUnit(landUnits))
        if (read.kind !== 'price') return perUnit * landUnits > MAX_ASKING_PRICE
        return Math.abs(shownAsking(read.price, perLandUnit(landUnits)) - perUnit) <= perUnit * 1e-12
      }),
    )
  })
})
