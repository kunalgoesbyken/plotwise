import { describe, expect, it } from 'bun:test'
import type { LngLat } from '@/geo/projection'
import { dropCoveredOutlines } from './coverage'
import { groupHoles } from './ring'
import type { Building } from './schema'

const rect = (x: number, y: number, width: number, height: number): LngLat[] => [
  [x, y],
  [x + width, y],
  [x + width, y + height],
  [x, y + height],
]

function building(id: string, outer: LngLat[], holes: LngLat[][] = []): Building {
  const [group] = groupHoles([outer], holes)
  return { id, ...group, heightM: 20, heightSource: 'height', minHeightM: 0 }
}

const outline = building('outline', rect(100, 13, 0.001, 0.001))

describe('dropCoveredOutlines', () => {
  it('keeps every outline when there are no parts', () => {
    expect(dropCoveredOutlines([outline], [])).toEqual([outline])
  })

  it('drops an outline whose parts tile it exactly', () => {
    const parts = [building('a', rect(100, 13, 0.0005, 0.001)), building('b', rect(100.0005, 13, 0.0005, 0.001))]
    expect(dropCoveredOutlines([outline], parts)).toEqual([])
  })

  it('drops an outline covered by overlapping stacked parts', () => {
    const parts = [building('podium', rect(100, 13, 0.001, 0.001)), building('tower', rect(100.0002, 13.0002, 0.0004, 0.0004))]
    expect(dropCoveredOutlines([outline], parts)).toEqual([])
  })

  it('drops an outline that parts cover with a few metres of mapping slack', () => {
    const parts = [building('a', rect(100, 13, 0.001, 0.00099))]
    expect(dropCoveredOutlines([outline], parts)).toEqual([])
  })

  it('keeps an outline that parts cover only partly', () => {
    const parts = [building('a', rect(100, 13, 0.0005, 0.001))]
    expect(dropCoveredOutlines([outline], parts)).toEqual([outline])
  })

  it('counts overlapping parts once', () => {
    const parts = [building('a', rect(100, 13, 0.0006, 0.001)), building('b', rect(100, 13, 0.0006, 0.001))]
    expect(dropCoveredOutlines([outline], parts)).toEqual([outline])
  })

  it('keeps an outline when its parts lie elsewhere', () => {
    const parts = [building('far', rect(100.01, 13.01, 0.001, 0.001))]
    expect(dropCoveredOutlines([outline], parts)).toEqual([outline])
  })

  it('does not count a part courtyard as covered', () => {
    const ringPart = building('ring', rect(100, 13, 0.001, 0.001), [rect(100.0003, 13.0003, 0.0004, 0.0004)])
    expect(dropCoveredOutlines([outline], [ringPart])).toEqual([outline])
  })

  it('compares against the outline footprint net of its own courtyard', () => {
    const withCourtyard = building('court', rect(100, 13, 0.001, 0.001), [rect(100.0003, 13.0003, 0.0004, 0.0004)])
    const ringPart = building('ring', rect(100, 13, 0.001, 0.001), [rect(100.0003, 13.0003, 0.0004, 0.0004)])
    expect(dropCoveredOutlines([withCourtyard], [ringPart])).toEqual([])
  })

  it('only drops the covered outlines', () => {
    const other = building('other', rect(100.01, 13, 0.001, 0.001))
    const parts = [building('a', rect(100, 13, 0.001, 0.001))]
    expect(dropCoveredOutlines([outline, other], parts)).toEqual([other])
  })
})
