import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import type { Vec2 } from '@/geo/projection'
import { cameraPosition, framingOf, needsReframe } from './framing'

const rectangle = (x: number, y: number, w: number, h: number): Vec2[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
]

const distance = (a: readonly number[], b: readonly number[]) => Math.hypot(...a.map((v, i) => v - b[i]))

describe('framingOf', () => {
  it('aims at the middle of the plot, a third of the way up the tallest volume', () => {
    expect(framingOf(rectangle(100, 200, 80, 60), 45)).toEqual({ target: [140, 230, 15], radiusM: 50 })
  })

  it('grows with whichever is larger, the plot or the height, and never frames tighter than a small plot', () => {
    expect(framingOf(rectangle(0, 0, 400, 300), 0).radiusM).toBe(250)
    expect(framingOf(rectangle(0, 0, 40, 30), 300).radiusM).toBe(150)
    expect(framingOf(rectangle(0, 0, 4, 3), 0).radiusM).toBe(50)
  })
})

describe('cameraPosition', () => {
  it('looks down on the target from the south-west, further away for bigger framings', () => {
    fc.assert(
      fc.property(fc.double({ min: 50, max: 2000, noNaN: true }), (radiusM) => {
        const target = [10, 20, 5] as const
        const [x, y, z] = cameraPosition({ target, radiusM })
        expect(x).toBeLessThan(target[0])
        expect(y).toBeLessThan(target[1])
        expect(z).toBeGreaterThan(target[2])
        expect(distance([x, y, z], target) / radiusM).toBeCloseTo(4.5, 6)
      }),
    )
  })
})

describe('needsReframe', () => {
  const shown = framingOf(rectangle(0, 0, 160, 120), 0)

  it('keeps the view for small edits so the user’s orbit is not lost', () => {
    expect(needsReframe(shown, framingOf(rectangle(4, 0, 160, 124), 0))).toBe(false)
    expect(needsReframe(shown, framingOf(rectangle(0, 0, 160, 120), 20))).toBe(false)
  })

  it('reframes when the plot moves away, grows, shrinks or a tall volume appears', () => {
    expect(needsReframe(shown, framingOf(rectangle(300, 0, 160, 120), 0))).toBe(true)
    expect(needsReframe(shown, framingOf(rectangle(0, 0, 400, 300), 0))).toBe(true)
    expect(needsReframe(shown, framingOf(rectangle(0, 0, 40, 30), 0))).toBe(true)
    expect(needsReframe(shown, framingOf(rectangle(0, 0, 160, 120), 160))).toBe(true)
  })
})
