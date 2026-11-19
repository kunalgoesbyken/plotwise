import { describe, expect, it } from 'bun:test'
import type { LngLat } from '@/geo/projection'
import { isSimplePath } from './path'

describe('isSimplePath', () => {
  it('accepts an open path that would cross only when closed', () => {
    const path: LngLat[] = [
      [0, 0],
      [2, 0],
      [2, 1],
      [0, 1],
      [1, 2],
    ]
    expect(isSimplePath(path)).toBe(true)
  })

  it('rejects a path whose new segment crosses an earlier one', () => {
    expect(
      isSimplePath([
        [0, 0],
        [2, 0],
        [2, 2],
        [1, -1],
      ]),
    ).toBe(false)
  })

  it('rejects a repeated point', () => {
    expect(
      isSimplePath([
        [0, 0],
        [0, 0],
      ]),
    ).toBe(false)
  })

  it('accepts a single point and an empty path', () => {
    expect(isSimplePath([[0, 0]])).toBe(true)
    expect(isSimplePath([])).toBe(true)
  })
})
