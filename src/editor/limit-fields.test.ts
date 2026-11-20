import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import { PlotLimitsSchema, type Plot, type PlotLimitField } from '@/plot/plot'
import { REGIONS } from '@/region/regions'
import { AREA_UNITS } from '@/units/area'
import { FIELD_UNITS, limitDisplay, parseLimit, shownLimit, type LimitDisplay } from './limit-fields'
import { decodePlot, encodePlot } from './plot-url'

const PLOT: Plot = {
  ring: [
    [55.208, 25.058],
    [55.2084, 25.058],
    [55.2084, 25.0583],
  ],
  roads: [{ edge: 0, widthM: 12 }],
  buildingType: 'condo',
  nearStation: false,
}

const BANGKOK: LimitDisplay = { area: 'sqm', floors: 'storeys' }
const DUBAI: LimitDisplay = { area: 'sqft', floors: 'gPlus' }

const read = (field: PlotLimitField, text: string, display: LimitDisplay) => {
  const parsed = parseLimit(field, text, display)
  return parsed.kind === 'number' ? parsed.value : Number.NaN
}

const FIELDS = Object.keys(PlotLimitsSchema.shape) as PlotLimitField[]

describe('entered limits shown in the region’s units', () => {
  it('has a display unit for every limit a plot can carry', () => {
    expect(Object.keys(FIELD_UNITS).sort()).toEqual([...FIELDS].sort())
  })

  it('reads typed text into internal metres, square metres and shares', () => {
    expect(read('maxGfaSqm', '5,000', BANGKOK)).toBe(5000)
    expect(read('maxCoverageShare', '60', BANGKOK)).toBeCloseTo(0.6, 12)
    expect(read('roadSetbackM', ' 4.5 ', BANGKOK)).toBe(4.5)
    expect(read('maxFar', '2.5', BANGKOK)).toBe(2.5)
    expect(read('maxStoreys', '12', BANGKOK)).toBe(12)
  })

  it('reads square feet and G+ floors as the Dubai affection plan states them', () => {
    expect(read('maxGfaSqm', '10763.91', DUBAI)).toBeCloseTo(1000, 3)
    expect(read('parkingSqmPerSpace', '538.2', DUBAI)).toBeCloseTo(50, 2)
    expect(read('maxStoreys', '10', DUBAI)).toBe(11)
    expect(read('maxStoreys', '0', DUBAI)).toBe(1)
    expect(shownLimit('maxStoreys', 11, DUBAI)).toBe('10')
    expect(shownLimit('maxGfaSqm', 1000, DUBAI)).toBe('10763.9104167')
    expect(shownLimit('maxCoverageShare', 0.6, BANGKOK)).toBe('60')
  })

  it('reads Dubai areas in square metres unless square feet are chosen, as the affection plan states them', () => {
    const dubai = limitDisplay(REGIONS.dxb, REGIONS.dxb.limitAreaUnit)
    expect(dubai).toEqual({ area: 'sqm', floors: 'gPlus' })
    expect(read('maxGfaSqm', '3000', dubai)).toBe(3000)
    expect(read('parkingSqmPerSpace', '50', dubai)).toBe(50)
    expect(read('maxGfaSqm', '32291.7', limitDisplay(REGIONS.dxb, 'sqft'))).toBeCloseTo(3000, 2)
  })

  it('shows a stored floor area the same in either unit after a link round-trip, as links made before the toggle store it', () => {
    const link = `${encodePlot({ ...PLOT, limits: { maxGfaSqm: 3000 } })}`
    expect(link).toContain('limits=maxGfaSqm:3000')
    const decoded = decodePlot(link)
    const stored = decoded?.ok ? decoded.plot.limits?.maxGfaSqm : undefined
    expect(stored).toBe(3000)
    expect(shownLimit('maxGfaSqm', 3000, limitDisplay(REGIONS.dxb, 'sqm'))).toBe('3000')
    expect(shownLimit('maxGfaSqm', 3000, limitDisplay(REGIONS.dxb, 'sqft'))).toBe('32291.7312501')
  })

  it('stores the same square metres in the link whichever unit a floor area is typed in', () => {
    fc.assert(
      fc.property(fc.double({ min: 1, max: 1e5, noNaN: true }), fc.constantFrom(...AREA_UNITS), (sqm, unit) => {
        const display = limitDisplay(REGIONS.dxb, unit)
        const typed = read('maxGfaSqm', shownLimit('maxGfaSqm', sqm, display), display)
        const decoded = decodePlot(encodePlot({ ...PLOT, limits: { maxGfaSqm: typed } }))
        expect(decoded?.ok && decoded.plot.limits?.maxGfaSqm).toBe(typed)
        expect(typed / sqm).toBeCloseTo(1, 9)
      }),
    )
  })

  it('reads blank text as no limit and anything else unreadable as nothing', () => {
    expect(parseLimit('maxGfaSqm', '  ', BANGKOK)).toEqual({ kind: 'blank' })
    for (const text of ['abc', '1e999', '-5', '0x10', '5 m', 'NaN', '1.2.3']) {
      expect(parseLimit('maxGfaSqm', text, BANGKOK)).toEqual({ kind: 'unreadable', reason: 'not-a-number' })
    }
  })

  it('refuses a decimal comma, so a ratio of 2,5 is never read as 25', () => {
    for (const [field, text] of [['maxFar', '2,5'], ['maxCoverageShare', '62,5'], ['roadSetbackM', '4,5'], ['maxGfaSqm', '1,5']] as const) {
      expect(parseLimit(field, text, BANGKOK)).toEqual({ kind: 'unreadable', reason: 'comma' })
      expect(parseLimit(field, text, DUBAI)).toEqual({ kind: 'unreadable', reason: 'comma' })
    }
  })

  it('shows any stored value back as the text that reads to it', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...FIELDS),
        fc.double({ min: 0.01, max: 1e5, noNaN: true }),
        fc.constantFrom(...AREA_UNITS),
        fc.constantFrom('storeys' as const, 'gPlus' as const),
        (field, raw, area, floors) => {
          const display = { area, floors }
          const value = field === 'maxStoreys' ? Math.ceil(raw) : raw
          expect(read(field, shownLimit(field, value, display), display) / value).toBeCloseTo(1, 9)
        },
      ),
    )
  })
})
