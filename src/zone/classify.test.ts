import { describe, expect, it } from 'bun:test'
import fc from 'fast-check'
import type { LngLat } from '@/geo/projection'
import { classifyShares, unknownVerdict, zoneRegionFor } from './classify'
import { ZONE_SOURCES } from './sources'

const brown = 'ย.๙'
const blue = 'ส.'
const { bkk } = ZONE_SOURCES

const square = ([lng, lat]: LngLat): LngLat[] => [
  [lng, lat],
  [lng + 0.0003, lat],
  [lng + 0.0003, lat + 0.0003],
  [lng, lat + 0.0003],
]

describe('zoneRegionFor', () => {
  it('finds the region whose coverage holds the plot', () => {
    expect(zoneRegionFor(square([100.5755, 13.7789]))).toBe('bkk')
  })

  it('finds no region for a plot outside every coverage', () => {
    expect(zoneRegionFor(square([77.59, 12.97]))).toBeUndefined()
  })
})

describe('classifyShares on the Bangkok layer', () => {
  it('puts a plot wholly in the covered zone inside', () => {
    expect(classifyShares(bkk, [{ code: brown, share: 1 }])).toEqual({ status: 'inside', zone: 'brown zone 9 (very high-density residential)' })
  })

  it('puts a plot wholly in another zone outside and names the covered zone', () => {
    expect(classifyShares(bkk, [{ code: blue, share: 1 }])).toEqual({
      status: 'outside',
      zone: 'blue zone',
      covered: 'brown zone 9 (very high-density residential)',
    })
  })

  it('ignores a boundary sliver and still calls the plot inside', () => {
    expect(classifyShares(bkk, [{ code: brown, share: 0.995 }, { code: blue, share: 0.005 }]).status).toBe('inside')
  })

  it('reports a split with the larger part first', () => {
    const verdict = classifyShares(bkk, [{ code: blue, share: 0.3 }, { code: brown, share: 0.7 }])
    expect(verdict).toEqual({
      status: 'straddles',
      parts: [
        { zone: 'brown zone 9 (very high-density residential)', share: 0.7 },
        { zone: 'blue zone', share: 0.3 },
      ],
      covered: 'brown zone 9 (very high-density residential)',
    })
  })

  it('refuses to guess when the plan maps only part of the plot', () => {
    expect(classifyShares(bkk, [{ code: brown, share: 0.6 }])).toEqual(unknownVerdict(bkk, 'no-zone'))
  })

  it('refuses to guess when the plan maps nothing under the plot', () => {
    expect(classifyShares(bkk, [])).toEqual(unknownVerdict(bkk, 'no-zone'))
  })

  it('refuses to guess when a zone code is not in the list', () => {
    expect(classifyShares(bkk, [{ code: 'ZZ', share: 1 }])).toEqual(unknownVerdict(bkk, 'unrecognised'))
  })

  it('calls a plot inside only when the covered zone holds at least 99% of it', () => {
    const statusFor = (covered: number) => classifyShares(bkk, [{ code: brown, share: covered }, { code: blue, share: 1 - covered }]).status
    fc.assert(fc.property(fc.double({ min: 0.9901, max: 1, noNaN: true }), (covered) => expect(statusFor(covered)).toBe('inside')))
    fc.assert(fc.property(fc.double({ min: 0.02, max: 0.9899, noNaN: true }), (covered) => expect(statusFor(covered)).toBe('straddles')))
  })
})
