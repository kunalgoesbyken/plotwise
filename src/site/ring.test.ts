import { describe, expect, it } from 'bun:test'
import type { LngLat } from '@/geo/projection'
import { assembleRings, groupHoles, orient, pointInRing, signedArea, toOpenRing } from './ring'

const square = (x: number, y: number, size: number): LngLat[] => [
  [x, y],
  [x + size, y],
  [x + size, y + size],
  [x, y + size],
]

describe('toOpenRing', () => {
  it('drops the repeated closing point', () => {
    expect(toOpenRing([...square(0, 0, 1), [0, 0]])).toEqual(square(0, 0, 1))
  })

  it('rejects an unclosed line', () => {
    expect(toOpenRing(square(0, 0, 1))).toBeUndefined()
  })

  it('rejects a ring with fewer than three distinct points', () => {
    expect(
      toOpenRing([
        [0, 0],
        [1, 1],
        [0, 0],
      ]),
    ).toBeUndefined()
  })
})

describe('orient', () => {
  it('makes a ring counter-clockwise or clockwise', () => {
    const clockwise = [...square(0, 0, 1)].reverse()
    expect(signedArea(orient(clockwise, 'ccw'))).toBeGreaterThan(0)
    expect(signedArea(orient(square(0, 0, 1), 'cw'))).toBeLessThan(0)
  })
})

describe('pointInRing', () => {
  it('tells inside from outside', () => {
    expect(pointInRing([0.5, 0.5], square(0, 0, 1))).toBe(true)
    expect(pointInRing([1.5, 0.5], square(0, 0, 1))).toBe(false)
  })
})

describe('assembleRings', () => {
  it('passes a closed line through', () => {
    expect(assembleRings([[...square(0, 0, 1), [0, 0]]])).toEqual([square(0, 0, 1)])
  })

  it('joins two halves into one ring', () => {
    const rings = assembleRings([
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      [
        [1, 1],
        [0, 1],
        [0, 0],
      ],
    ])
    expect(rings).toHaveLength(1)
    expect(Math.abs(signedArea(rings[0]))).toBe(1)
  })

  it('joins halves that run in opposite directions, in any order', () => {
    const rings = assembleRings([
      [
        [0, 0],
        [0, 1],
        [1, 1],
      ],
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
    ])
    expect(rings).toHaveLength(1)
    expect(Math.abs(signedArea(rings[0]))).toBe(1)
  })

  it('joins three ways into one ring', () => {
    const rings = assembleRings([
      [
        [0, 0],
        [1, 0],
      ],
      [
        [1, 1],
        [0, 0],
      ],
      [
        [1, 0],
        [1, 1],
      ],
    ])
    expect(rings).toHaveLength(1)
    expect(rings[0]).toHaveLength(3)
  })

  it('assembles separate rings independently', () => {
    expect(assembleRings([[...square(0, 0, 1), [0, 0]], [...square(5, 5, 1), [5, 5]]])).toHaveLength(2)
  })

  it('drops lines that never close', () => {
    expect(
      assembleRings([
        [
          [0, 0],
          [1, 0],
          [1, 1],
        ],
      ]),
    ).toEqual([])
  })
})

describe('groupHoles', () => {
  it('assigns a hole to the outer ring that contains it', () => {
    const groups = groupHoles([square(0, 0, 10), square(20, 0, 10)], [square(2, 2, 2), square(22, 2, 2)])
    expect(groups).toHaveLength(2)
    expect(groups[0].holes).toEqual([orient(square(2, 2, 2), 'cw')])
    expect(groups[1].holes).toEqual([orient(square(22, 2, 2), 'cw')])
  })

  it('picks the smallest outer ring when islands are nested', () => {
    const groups = groupHoles([square(0, 0, 100), square(40, 40, 20)], [square(45, 45, 5)])
    expect(groups[0].holes).toHaveLength(0)
    expect(groups[1].holes).toHaveLength(1)
  })

  it('discards a hole that sits in no outer ring', () => {
    expect(groupHoles([square(0, 0, 1)], [square(5, 5, 1)])[0].holes).toEqual([])
  })

  it('returns outer rings counter-clockwise and holes clockwise', () => {
    const [group] = groupHoles([[...square(0, 0, 10)].reverse()], [square(2, 2, 2)])
    expect(signedArea(group.outer)).toBeGreaterThan(0)
    expect(signedArea(group.holes[0])).toBeLessThan(0)
  })
})
