import { describe, expect, it } from 'bun:test'
import fc from 'fast-check'
import { BANGKOK } from '@/rules/test-packs'
import { MONEY_REGIONS, type MoneyRegion, type RegionId } from '@/solve'
import { SQM_PER_SQFT } from '@/units/area'
import { MAX_ASKING_PRICE } from './asking-price'
import { decodeAskingPrice, decodeAssumptions, encodeAskingPrice, encodeAssumptions } from './url'
import { sourcedValues, type Overrides } from './values'

const bkk = MONEY_REGIONS.bkk

const overridesOf = (encoded: string | null, region: MoneyRegion = bkk) => decodeAssumptions(encoded, region).overrides

const roundTrip = (overrides: Overrides) => overridesOf(encodeAssumptions(overrides))

describe('assumption share links', () => {
  it('keeps the meaning of the keys old links already use', () => {
    const overrides = overridesOf('salePrice.condo:300000;margin:0.2;softCost:0.1;parkingLevels:3;substructure.lowRise.low:5000')
    expect(overrides).toEqual({ 'salePrice.condo': 300000, margin: 0.2, softCost: 0.1, parkingLevels: 3, 'substructure.lowRise.low': 5000 })
  })

  it('reads the land cost and reference keys', () => {
    const encoded = 'transferCosts:0.02;holdingCost:0.03;landFinance:0.15;landReferenceLow:100000;landReferenceHigh:400000'
    expect(overridesOf(encoded)).toEqual({
      transferCosts: 0.02,
      holdingCost: 0.03,
      landFinance: 0.15,
      landReferenceLow: 100000,
      landReferenceHigh: 400000,
    })
  })

  it('uses the defaults of the plot area for keys a link does not carry', () => {
    const old = overridesOf('salePrice.condo:300000')
    const values = sourcedValues(bkk, { pack: BANGKOK, use: 'condo', tier: 'suburban' }, old)
    expect(values.salePrice).toBe(300000)
    expect(values.transferCosts).toBe(bkk.generic.transferCostShare.value)
    expect(values.landReferenceHigh).toBe(bkk.local.landReferencePerUnit.suburban.high)
  })

  it('gives each area its own sale price default, dearer nearer the centre', () => {
    const price = (tier: 'cbd' | 'cityFringe' | 'suburban') => sourcedValues(bkk, { pack: BANGKOK, use: 'condo', tier }).salePrice
    expect(price('cbd')).toBeGreaterThan(price('cityFringe'))
    expect(price('cityFringe')).toBeGreaterThan(price('suburban'))
  })

  it('drops keys it does not know and values out of range', () => {
    expect(overridesOf('landFinance:2;holdingCost:abc;unknown:1;landReferenceLow:-5')).toEqual({})
  })

  it('round-trips the overrides it encodes', () => {
    const overrides = { 'salePrice.condo': 300000, landFinance: 0.15, landReferenceHigh: 400000, parkingLevels: 3 }
    expect(roundTrip(overrides)).toEqual(overrides)
  })

  it('round-trips a build rate edited for one building type and the basement rate', () => {
    const overrides = { 'services.low.office': 9000, 'services.high.office': 12000, 'basement.high': 21000 }
    expect(roundTrip(overrides)).toEqual(overrides)
  })

  it('reads an old Dubai link’s land reference prices, written per sq ft, as prices per m²', () => {
    const old = overridesOf('landReferenceLow:1000;landReferenceHigh:2000;margin:0.2', MONEY_REGIONS.dxb)
    expect(old.landReferenceLow).toBeCloseTo(1000 / SQM_PER_SQFT, 9)
    expect(old.landReferenceHigh).toBeCloseTo(2000 / SQM_PER_SQFT, 9)
    expect(old.margin).toBe(0.2)
  })

  it('keeps an old link’s land reference prices where the land unit never changed', () => {
    for (const region of ['bkk', 'mum', 'custom'] as const) expect(overridesOf('landReferenceLow:1000', MONEY_REGIONS[region])).toEqual({ landReferenceLow: 1000 })
  })

  it('drops an old Dubai land reference price that is out of range once read per m²', () => {
    expect(overridesOf('landReferenceHigh:999999999', MONEY_REGIONS.dxb)).toEqual({})
  })

  it('round-trips the land reference prices it encodes in every region', () => {
    const regions = Object.keys(MONEY_REGIONS) as RegionId[]
    fc.assert(
      fc.property(fc.constantFrom(...regions), fc.integer({ min: 0, max: 1_000_000_000 }), (region, price) => {
        const overrides = { landReferenceLow: price }
        expect(overridesOf(encodeAssumptions(overrides), MONEY_REGIONS[region])).toEqual(overrides)
      }),
    )
  })

  it('writes nothing when there are no overrides', () => {
    expect(encodeAssumptions({})).toBeNull()
    expect(decodeAssumptions(null, bkk)).toEqual({ overrides: {}, examples: null })
  })
})

describe('example values in share links', () => {
  const mum = MONEY_REGIONS.mum

  it('round-trips the choice to fill or clear the example values, with or without typed values', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.option(fc.integer({ min: 0, max: 1_000_000_000 }), { nil: undefined }), (examples, price) => {
        const overrides = price === undefined ? {} : { 'salePrice.condo': price }
        expect(decodeAssumptions(encodeAssumptions(overrides, examples), mum)).toEqual({ overrides, examples })
      }),
    )
  })

  it('reads a link that never chose, an old link included, as following the plot', () => {
    expect(decodeAssumptions('salePrice.condo:300000', mum)).toEqual({ overrides: { 'salePrice.condo': 300000 }, examples: null })
    expect(decodeAssumptions(encodeAssumptions({ margin: 0.2 }), mum).examples).toBeNull()
  })

  it('ignores an example choice that is not exactly one 0 or 1', () => {
    for (const encoded of ['v:2;examples:yes', 'v:2;examples:', 'v:2;examples:2', 'v:2;examples:1;examples:0', 'v:2;examples:true']) {
      expect(decodeAssumptions(encoded, mum).examples).toBeNull()
    }
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
