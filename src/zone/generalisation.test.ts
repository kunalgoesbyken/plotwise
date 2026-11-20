import { describe, expect, it } from 'bun:test'
import fc from 'fast-check'
import { localFrame, type LngLat, type Vec2 } from '@/geo/projection'
import { ZONE_COORDINATE_DECIMALS, ZONE_GENERALISATION_DEGREES, ZONE_SLIVER_SHARE } from './assumptions'
import { classifyShares } from './classify'
import { generalisationDegrees } from './generalisation'
import { zoneShares } from './shares'
import { ZONE_SOURCES } from './sources'

const ORIGIN: LngLat = [100.5755, 13.7789]
const frame = localFrame(ORIGIN)
const brown = 'ย.๙'
const blue = 'ส.'

const box = ([x0, y0]: Vec2, [x1, y1]: Vec2): LngLat[] => ([[x0, y0], [x1, y0], [x1, y1], [x0, y1]] as Vec2[]).map(frame.toLngLat)
const clockwise = (ring: LngLat[]) => [...ring].reverse()

const roundingDegrees = Math.SQRT1_2 * 10 ** -ZONE_COORDINATE_DECIMALS.value

function shareMovedBy(plot: LngLat[], northM: number, shiftDegrees: number): number {
  const zone = (north: number) => [{ code: blue, rings: [clockwise([[ORIGIN[0] - 0.01, north], [ORIGIN[0] + 0.01, north], [ORIGIN[0] + 0.01, ORIGIN[1] + 0.01], [ORIGIN[0] - 0.01, ORIGIN[1] + 0.01]])] }]
  const line = frame.toLngLat([0, northM])[1]
  const share = (north: number) => zoneShares(plot, zone(north)).find(({ code }) => code === blue)?.share ?? 0
  return Math.abs(share(line - shiftDegrees) - share(line))
}

describe('zone boundary generalisation asked of the layer', () => {
  it('asks a large plot for the full generalisation, which keeps the answer small', () => {
    expect(generalisationDegrees(box([0, 0], [200, 200]))).toBe(ZONE_GENERALISATION_DEGREES.value)
  })

  it('asks a narrow plot for less, never below zero', () => {
    expect(generalisationDegrees(box([0, 0], [40, 10]))).toBeLessThan(ZONE_GENERALISATION_DEGREES.value)
    expect(generalisationDegrees(box([0, 0], [40, 0.5]))).toBe(0)
  })

  it('moves no share of a plot a metre or more across by more than the sliver share, rounding included', () => {
    fc.assert(
      fc.property(fc.double({ min: 1, max: 200, noNaN: true }), fc.double({ min: 1, max: 300, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }), (depthM, lengthM, along) => {
        const plot = box([0, 0], [lengthM, depthM])
        const shift = generalisationDegrees(plot) + roundingDegrees
        expect(shareMovedBy(plot, depthM * along, shift)).toBeLessThanOrEqual(ZONE_SLIVER_SHARE.value + 1e-9)
      }),
    )
  })

  it('keeps a 10 m-wide plot whose edge lies on a zone line inside its zone', () => {
    const plot = box([0, 0], [40, 10])
    const shift = generalisationDegrees(plot) + roundingDegrees
    const intruding = shareMovedBy(plot, 10, shift)
    const verdict = classifyShares(ZONE_SOURCES.bkk, [
      { code: brown, share: 1 - intruding },
      { code: blue, share: intruding },
    ])
    expect(verdict.status).toBe('inside')
    expect(shareMovedBy(plot, 10, ZONE_GENERALISATION_DEGREES.value)).toBeGreaterThan(ZONE_SLIVER_SHARE.value)
  })
})
