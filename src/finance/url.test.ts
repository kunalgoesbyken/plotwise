import { describe, expect, it } from 'bun:test'
import { MONEY_REGIONS } from '@/solve'
import { MAX_ASKING_PRICE } from './asking-price'
import { decodeAskingPrice, decodeAssumptions, encodeAskingPrice, encodeAssumptions } from './url'
import { resolveValues } from './values'

const prices = MONEY_REGIONS.bkk.prices

describe('assumption share links', () => {
  it('keeps the meaning of the keys old links already use', () => {
    const overrides = decodeAssumptions('salePrice.condo:300000;margin:0.2;softCost:0.1;parkingLevels:3;substructure.lowRise.low:5000')
    expect(overrides).toEqual({ 'salePrice.condo': 300000, margin: 0.2, softCost: 0.1, parkingLevels: 3, 'substructure.lowRise.low': 5000 })
  })

  it('reads the land cost and reference keys', () => {
    const encoded = 'transferCosts:0.02;holdingCost:0.03;landFinance:0.15;landReferenceLow:100000;landReferenceHigh:400000'
    expect(decodeAssumptions(encoded)).toEqual({
      transferCosts: 0.02,
      holdingCost: 0.03,
      landFinance: 0.15,
      landReferenceLow: 100000,
      landReferenceHigh: 400000,
    })
  })

  it('uses the defaults of the plot area for keys a link does not carry', () => {
    const old = decodeAssumptions('salePrice.condo:300000')
    const values = resolveValues(prices, { use: 'condo', tier: 'suburban' }, old)
    expect(values.salePrice).toBe(300000)
    expect(values.transferCosts).toBe(prices.transferCostShare.value)
    expect(values.landReferenceHigh).toBe(prices.landReferencePerUnit.suburban.high)
  })

  it('gives each area its own sale price default, dearer nearer the centre', () => {
    const price = (tier: 'cbd' | 'cityFringe' | 'suburban') => resolveValues(prices, { use: 'condo', tier }, {}).salePrice
    expect(price('cbd')).toBeGreaterThan(price('cityFringe'))
    expect(price('cityFringe')).toBeGreaterThan(price('suburban'))
  })

  it('drops keys it does not know and values out of range', () => {
    expect(decodeAssumptions('landFinance:2;holdingCost:abc;unknown:1;landReferenceLow:-5')).toEqual({})
  })

  it('round-trips the overrides it encodes', () => {
    const overrides = { 'salePrice.condo': 300000, landFinance: 0.15, landReferenceHigh: 400000, parkingLevels: 3 }
    expect(decodeAssumptions(encodeAssumptions(overrides))).toEqual(overrides)
  })

  it('writes nothing when there are no overrides', () => {
    expect(encodeAssumptions({})).toBeNull()
    expect(decodeAssumptions(null)).toEqual({})
  })
})

describe('asking price share links', () => {
  it('round-trips the price it encodes', () => {
    expect(decodeAskingPrice(encodeAskingPrice(200_000_000))).toBe(200_000_000)
    expect(decodeAskingPrice(encodeAskingPrice(1234.5))).toBe(1234.5)
  })

  it('writes nothing for a blank price and reads an old link without one as blank', () => {
    expect(encodeAskingPrice(null)).toBeNull()
    expect(decodeAskingPrice(null)).toBeNull()
  })

  it('reads a price that is not positive, finite and at most the maximum as blank', () => {
    for (const text of ['', ' ', 'abc', '0', '-5', 'Infinity', 'NaN', '1e400', String(MAX_ASKING_PRICE * 10), '200M', '2,000']) {
      expect(decodeAskingPrice(text)).toBeNull()
    }
  })
})
