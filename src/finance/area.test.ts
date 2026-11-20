import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import { localFrame } from '@/geo/projection'
import { MONEY_REGIONS } from '@/solve'
import { EXAMPLE_PLOT } from '@/plot/example-plot'
import { placementOf } from './area'

const { areas } = MONEY_REGIONS.bkk.prices
const frame = localFrame([areas.centre.lng, areas.centre.lat])
const atKm = (km: number) => frame.toLngLat([km * 1000, 0])

describe('placementOf', () => {
  it('puts the centre in the CBD', () => {
    expect(placementOf([areas.centre.lng, areas.centre.lat], areas)).toEqual({ tier: 'cbd', distanceKm: 0, determined: true })
  })

  it('puts the example plot in Huai Khwang in the city fringe', () => {
    expect(placementOf(EXAMPLE_PLOT.ring[0], areas).tier).toBe('cityFringe')
  })

  it('switches tier at each radius', () => {
    const { cbd, cityFringe, coverage } = areas.radiusKm
    expect(placementOf(atKm(cbd - 0.01), areas).tier).toBe('cbd')
    expect(placementOf(atKm(cbd + 0.01), areas).tier).toBe('cityFringe')
    expect(placementOf(atKm(cityFringe - 0.01), areas).tier).toBe('cityFringe')
    expect(placementOf(atKm(cityFringe + 0.01), areas).tier).toBe('suburban')
    expect(placementOf(atKm(coverage - 0.01), areas).tier).toBe('suburban')
  })

  it('falls back to the fallback tier beyond the coverage limit', () => {
    const placement = placementOf(atKm(areas.radiusKm.coverage + 1), areas)
    expect(placement.tier).toBe(areas.fallbackTier)
    expect(placement.determined).toBe(false)
  })

  it('falls back to the fallback tier when the position is not a number', () => {
    expect(placementOf([Number.NaN, Number.NaN], areas)).toMatchObject({ tier: areas.fallbackTier, determined: false })
  })

  it('never lets a farther point land in a nearer tier', () => {
    const order = { cbd: 0, cityFringe: 1, suburban: 2 } as const
    const { coverage } = areas.radiusKm
    fc.assert(
      fc.property(fc.double({ min: 0, max: coverage, noNaN: true }), fc.double({ min: 0, max: coverage, noNaN: true }), (a, b) => {
        const [near, far] = a <= b ? [a, b] : [b, a]
        expect(order[placementOf(atKm(near), areas).tier]).toBeLessThanOrEqual(order[placementOf(atKm(far), areas).tier])
      }),
    )
  })

  it('uses the more conservative fringe value for the fallback', () => {
    const { condo } = MONEY_REGIONS.bkk.prices.salePricePerSqm
    expect(areas.fallbackTier).toBe('cityFringe')
    expect(condo.cityFringe.value).toBeLessThan(condo.cbd.value)
  })
})
