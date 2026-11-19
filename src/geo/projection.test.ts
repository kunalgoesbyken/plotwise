import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import { localFrame } from './projection'

const bangkok = [100.5018, 13.7563] as const

describe('localFrame', () => {
  it('puts the origin at 0,0', () => {
    expect(localFrame(bangkok).toLocal(bangkok)).toEqual([0, 0])
  })

  it('measures 0.001 degrees of latitude as about 111.2 m north', () => {
    const [x, y] = localFrame(bangkok).toLocal([bangkok[0], bangkok[1] + 0.001])
    expect(x).toBeCloseTo(0, 6)
    expect(y).toBeCloseTo(111.19, 1)
  })

  it('shrinks east-west distances by cos(latitude)', () => {
    const [x] = localFrame(bangkok).toLocal([bangkok[0] + 0.001, bangkok[1]])
    expect(x).toBeCloseTo(111.19 * Math.cos((bangkok[1] * Math.PI) / 180), 1)
  })

  it('round-trips any point within 2 km to under a millimetre', () => {
    const frame = localFrame(bangkok)
    fc.assert(
      fc.property(fc.double({ min: -2000, max: 2000, noNaN: true }), fc.double({ min: -2000, max: 2000, noNaN: true }), (x, y) => {
        const [x2, y2] = frame.toLocal(frame.toLngLat([x, y]))
        expect(Math.abs(x2 - x)).toBeLessThan(1e-3)
        expect(Math.abs(y2 - y)).toBeLessThan(1e-3)
      }),
    )
  })
})
