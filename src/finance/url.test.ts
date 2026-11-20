import { describe, expect, it } from 'bun:test'
import { MONEY_REGIONS } from '@/solve'
import { decodeAssumptions, encodeAssumptions } from './url'
import { resolveValues } from './values'

const region = MONEY_REGIONS.bkk

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
    const values = resolveValues(region, { use: 'condo', tier: 'suburban' }, old)
    expect(values.salePrice).toBe(300000)
    expect(values.transferCosts).toBe(region.transferCostShare.value)
    expect(values.landReferenceHigh).toBe(region.landReferencePerUnit.suburban.high)
  })

  it('gives each area its own sale price default, dearer nearer the centre', () => {
    const price = (tier: 'cbd' | 'cityFringe' | 'suburban') => resolveValues(region, { use: 'condo', tier }, {}).salePrice
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
