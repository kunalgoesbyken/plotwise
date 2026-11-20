import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import { AREA_UNITS, areaFromDisplay, areaToDisplay, perAreaFromDisplay, perAreaToDisplay, SQM_PER_SQFT } from './area'

const positive = fc.double({ min: 1e-6, max: 1e9, noNaN: true })

describe('display area units', () => {
  it('defines the square foot from the international foot of exactly 0.3048 m', () => {
    expect(SQM_PER_SQFT).toBeCloseTo(0.09290304, 12)
  })

  it('shows square metres unchanged', () => {
    expect(areaToDisplay(1234.5, 'sqm')).toBe(1234.5)
    expect(areaFromDisplay(1234.5, 'sqm')).toBe(1234.5)
    expect(perAreaToDisplay(50_000, 'sqm')).toBe(50_000)
    expect(perAreaFromDisplay(50_000, 'sqm')).toBe(50_000)
  })

  it('shows 1,000 m² as about 10,764 sq ft', () => {
    expect(areaToDisplay(1000, 'sqft')).toBeCloseTo(10_763.91, 2)
    expect(areaFromDisplay(10_763.910_416_709_722, 'sqft')).toBeCloseTo(1000, 9)
  })

  it('shows a price per m² as the smaller price per sq ft', () => {
    expect(perAreaToDisplay(10_000, 'sqft')).toBeCloseTo(929.0304, 9)
    expect(perAreaFromDisplay(929.0304, 'sqft')).toBeCloseTo(10_000, 9)
  })

  it('round-trips areas and prices per area in every unit', () => {
    fc.assert(
      fc.property(positive, fc.constantFrom(...AREA_UNITS), (value, unit) => {
        expect(areaFromDisplay(areaToDisplay(value, unit), unit) / value).toBeCloseTo(1, 12)
        expect(perAreaFromDisplay(perAreaToDisplay(value, unit), unit) / value).toBeCloseTo(1, 12)
      }),
    )
  })

  it('keeps the value of a priced area whatever unit shows it', () => {
    fc.assert(
      fc.property(positive, positive, fc.constantFrom(...AREA_UNITS), (sqm, pricePerSqm, unit) => {
        const shown = areaToDisplay(sqm, unit) * perAreaToDisplay(pricePerSqm, unit)
        expect(shown / (sqm * pricePerSqm)).toBeCloseTo(1, 9)
      }),
    )
  })
})
