import { describe, expect, it } from 'bun:test'
import type { Vec2 } from '@/geo/projection'
import { pickTarget } from './map-hit'

const square: Vec2[] = [
  [0, 0],
  [100, 0],
  [100, 100],
  [0, 100],
]

describe('pickTarget', () => {
  it('prefers the nearest corner within reach', () => {
    expect(pickTarget(square, true, [96, 4], 10)).toEqual({ kind: 'corner', index: 1 })
  })

  it('picks an edge midpoint before the edge itself on a closed ring', () => {
    expect(pickTarget(square, true, [50, 3], 10)).toEqual({ kind: 'midpoint', edge: 0 })
    expect(pickTarget(square, true, [25, 3], 10)).toEqual({ kind: 'edge', index: 0 })
  })

  it('includes the closing edge of a closed ring', () => {
    expect(pickTarget(square, true, [-4, 70], 10)).toEqual({ kind: 'edge', index: 3 })
  })

  it('offers only corners and drawn edges while the outline is open', () => {
    expect(pickTarget(square, false, [-4, 70], 10)).toBeNull()
    expect(pickTarget(square, false, [50, 3], 10)).toEqual({ kind: 'edge', index: 0 })
    expect(pickTarget(square, false, [2, 2], 10)).toEqual({ kind: 'corner', index: 0 })
  })

  it('returns nothing out of reach', () => {
    expect(pickTarget(square, true, [50, 50], 10)).toBeNull()
  })
})
