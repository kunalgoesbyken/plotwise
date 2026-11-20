import { describe, expect, it } from 'bun:test'
import type { LngLat } from '@/geo/projection'
import { encodeRing, RingParamSchema } from './schema'

const plot: LngLat[] = [
  [100.5755, 13.7789],
  [100.5759, 13.7789],
  [100.5759, 13.7792],
  [100.5755, 13.7792],
]

describe('RingParamSchema', () => {
  it('accepts a ring in the form the client sends', () => {
    expect(RingParamSchema.safeParse(encodeRing(plot)).success).toBe(true)
  })

  it('refuses the same ring written with extra decimals, so every check shares one cache entry', () => {
    const verbose = plot.map(([lng, lat]) => `${lng}0001,${lat}`).join(';')
    expect(RingParamSchema.safeParse(verbose).success).toBe(false)
  })

  it('refuses a ring far larger than any plot', () => {
    const huge: LngLat[] = [
      [100.4, 13.6],
      [100.7, 13.6],
      [100.7, 13.9],
    ]
    expect(RingParamSchema.safeParse(encodeRing(huge)).success).toBe(false)
  })
})
