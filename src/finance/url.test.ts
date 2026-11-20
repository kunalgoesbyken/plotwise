import { describe, expect, it } from 'bun:test'
import fc from 'fast-check'
import { MONEY_REGIONS, type RegionId } from '@/solve'
import { SQM_PER_SQFT } from '@/units/area'
import { MAX_ASKING_PRICE } from './asking-price'
import { decodeAskingPrice, decodeAssumptions, encodeAskingPrice, encodeAssumptions } from './url'
import { resolveValues } from './values'

const bkk = MONEY_REGIONS.bkk

const prices = bkk.prices

describe('assumption share links', () => {
  it('keeps the meaning of the keys old links already use', () => {
    const overrides = decodeAssumptions('salePrice.condo:300000;margin:0.2;softCost:0.1;parkingLevels:3;substructure.lowRise.low:5000', bkk)
    expect(overrides).toEqual({ 'salePrice.condo': 300000, margin: 0.2, softCost: 0.1, parkingLevels: 3, 'substructure.lowRise.low': 5000 })
  })

  it('reads the land cost and reference keys', () => {
    const encoded = 'transferCosts:0.02;holdingCost:0.03;landFinance:0.15;landReferenceLow:100000;landReferenceHigh:400000'
    expect(decodeAssumptions(encoded, bkk)).toEqual({
      transferCosts: 0.02,
      holdingCost: 0.03,
      landFinance: 0.15,
      landReferenceLow: 100000,
      landReferenceHigh: 400000,
    })
  })

  it('uses the defaults of the plot area for keys a link does not carry', () => {
    const old = decodeAssumptions('salePrice.condo:300000', bkk)
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
    expect(decodeAssumptions('landFinance:2;holdingCost:abc;unknown:1;landReferenceLow:-5', bkk)).toEqual({})
  })

  it('round-trips the overrides it encodes', () => {
    const overrides = { 'salePrice.condo': 300000, landFinance: 0.15, landReferenceHigh: 400000, parkingLevels: 3 }
    expect(decodeAssumptions(encodeAssumptions(overrides), bkk)).toEqual(overrides)
  })

  it('round-trips a build rate edited for one building type and the basement rate', () => {
    const overrides = { 'services.low.office': 9000, 'services.high.office': 12000, 'basement.high': 21000 }
    expect(decodeAssumptions(encodeAssumptions(overrides), bkk)).toEqual(overrides)
  })

  it('reads an old Dubai link’s land reference prices, written per sq ft, as prices per m²', () => {
    const old = decodeAssumptions('landReferenceLow:1000;landReferenceHigh:2000;margin:0.2', MONEY_REGIONS.dxb)
    expect(old.landReferenceLow).toBeCloseTo(1000 / SQM_PER_SQFT, 9)
    expect(old.landReferenceHigh).toBeCloseTo(2000 / SQM_PER_SQFT, 9)
    expect(old.margin).toBe(0.2)
  })

  it('keeps an old link’s land reference prices where the land unit never changed', () => {
    for (const region of ['bkk', 'mum', 'custom'] as const) expect(decodeAssumptions('landReferenceLow:1000', MONEY_REGIONS[region])).toEqual({ landReferenceLow: 1000 })
  })

  it('drops an old Dubai land reference price that is out of range once read per m²', () => {
    expect(decodeAssumptions('landReferenceHigh:999999999', MONEY_REGIONS.dxb)).toEqual({})
  })

  it('round-trips the land reference prices it encodes in every region', () => {
    const regions = Object.keys(MONEY_REGIONS) as RegionId[]
    fc.assert(
      fc.property(fc.constantFrom(...regions), fc.integer({ min: 0, max: 1_000_000_000 }), (region, price) => {
        const overrides = { landReferenceLow: price }
        expect(decodeAssumptions(encodeAssumptions(overrides), MONEY_REGIONS[region])).toEqual(overrides)
      }),
    )
  })

  it('writes nothing when there are no overrides', () => {
    expect(encodeAssumptions({})).toBeNull()
    expect(decodeAssumptions(null, bkk)).toEqual({})
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
