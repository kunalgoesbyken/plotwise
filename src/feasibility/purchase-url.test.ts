import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import { ASSUMPTIONS } from '@/solve'
import { decodePurchase, encodePurchase } from './purchase-url'

describe('purchase share links', () => {
  it('writes each chosen ratio under a short key and leaves out what is not bought', () => {
    expect(encodePurchase({ premium: 0.5, transferableRights: 0.25, fungible: 0 })).toBe('premium:0.5;tdr:0.25')
    expect(encodePurchase({})).toBeNull()
    expect(encodePurchase({ premium: 0 })).toBeNull()
  })

  it('reads back every ratio it writes', () => {
    const ratio = fc.double({ min: 0.001, max: ASSUMPTIONS.plotMaxFar.value, noNaN: true })
    fc.assert(
      fc.property(ratio, ratio, ratio, (premium, transferableRights, fungible) => {
        const chosen = { premium, transferableRights, fungible }
        expect(decodePurchase(encodePurchase(chosen))).toEqual(chosen)
      }),
    )
  })

  it('refuses a whole link with an unknown key, a repeated key or a ratio out of range', () => {
    for (const bad of ['premium:0.5;bonus:1', 'premium:0.5;premium:0.2', 'premium:-1', 'premium:', 'premium:1e9', 'premium:abc', 'premium:0,5', 'tdr', ':0.5'])
      expect(decodePurchase(bad)).toEqual({})
    expect(decodePurchase(null)).toEqual({})
  })
})
