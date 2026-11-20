import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import { PlotLimitsSchema, type PlotLimitField } from '@/plot/plot'
import { AREA_UNITS } from '@/units/area'
import { FIELD_UNITS, parseLimit, shownLimit, type LimitDisplay } from './limit-fields'

const BANGKOK: LimitDisplay = { area: 'sqm', floors: 'storeys' }
const DUBAI: LimitDisplay = { area: 'sqft', floors: 'aboveGround' }
const FIELDS = Object.keys(PlotLimitsSchema.shape) as PlotLimitField[]

describe('entered limits shown in the region’s units', () => {
  it('has a display unit for every limit a plot can carry', () => {
    expect(Object.keys(FIELD_UNITS).sort()).toEqual([...FIELDS].sort())
  })

  it('reads typed text into internal metres, square metres and shares', () => {
    expect(parseLimit('maxGfaSqm', '5,000', BANGKOK)).toBe(5000)
    expect(parseLimit('maxCoverageShare', '60', BANGKOK)).toBeCloseTo(0.6, 12)
    expect(parseLimit('roadSetbackM', ' 4.5 ', BANGKOK)).toBe(4.5)
    expect(parseLimit('maxFar', '2.5', BANGKOK)).toBe(2.5)
    expect(parseLimit('maxStoreys', '12', BANGKOK)).toBe(12)
  })

  it('reads square feet and G+ floors as the Dubai affection plan states them', () => {
    expect(parseLimit('maxGfaSqm', '10763.91', DUBAI)).toBeCloseTo(1000, 3)
    expect(parseLimit('parkingSqmPerSpace', '538.2', DUBAI)).toBeCloseTo(50, 2)
    expect(parseLimit('maxStoreys', '10', DUBAI)).toBe(11)
    expect(parseLimit('maxStoreys', '0', DUBAI)).toBe(1)
    expect(shownLimit('maxStoreys', 11, DUBAI)).toBe('10')
    expect(shownLimit('maxGfaSqm', 1000, DUBAI)).toBe('10763.9104167')
    expect(shownLimit('maxCoverageShare', 0.6, BANGKOK)).toBe('60')
  })

  it('reads blank text as no limit and anything else unreadable as nothing', () => {
    expect(parseLimit('maxGfaSqm', '  ', BANGKOK)).toBeUndefined()
    for (const text of ['abc', '1e999', '-5', '0x10', '5 m', 'NaN', '1.2.3']) expect(parseLimit('maxGfaSqm', text, BANGKOK)).toBeNull()
  })

  it('shows any stored value back as the text that reads to it', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...FIELDS),
        fc.double({ min: 0.01, max: 1e5, noNaN: true }),
        fc.constantFrom(...AREA_UNITS),
        fc.constantFrom('storeys' as const, 'aboveGround' as const),
        (field, raw, area, floors) => {
          const display = { area, floors }
          const value = field === 'maxStoreys' ? Math.ceil(raw) : raw
          expect(parseLimit(field, shownLimit(field, value, display), display)! / value).toBeCloseTo(1, 9)
        },
      ),
    )
  })
})
