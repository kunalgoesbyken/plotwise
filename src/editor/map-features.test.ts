import { describe, expect, it } from 'bun:test'
import type { Plot } from '@/plot/plot'
import { initialEditorState, reduceEditor } from './editor-state'
import { cornerName, edgeName, mapFeatures, mapLabels } from './map-features'

const plot: Plot = {
  ring: [
    [0, 0],
    [2, 0],
    [2, 2],
    [0, 2],
  ],
  roads: [{ edge: 1, widthM: 12.5 }],
  buildingType: 'condo',
  nearStation: false,
}

const loaded = reduceEditor(initialEditorState('condo'), { type: 'load', plot })

describe('names', () => {
  it('letters corners like survey pegs and names edges by their corners', () => {
    expect([0, 1, 25, 26, 27, 51, 52].map(cornerName)).toEqual(['A', 'B', 'Z', 'AA', 'AB', 'AZ', 'BA'])
    expect(edgeName(1, 4)).toBe('B–C')
    expect(edgeName(3, 4)).toBe('D–A')
  })
})

describe('mapFeatures', () => {
  it('draws a closed plot as an area, edges, corners and edge midpoints', () => {
    const kinds = mapFeatures(loaded).features.map((f) => f.properties?.kind)
    expect(kinds.filter((k) => k === 'area')).toHaveLength(1)
    expect(kinds.filter((k) => k === 'edge')).toHaveLength(4)
    expect(kinds.filter((k) => k === 'corner')).toHaveLength(4)
    expect(kinds.filter((k) => k === 'midpoint')).toHaveLength(4)
  })

  it('marks road edges and the selected edge', () => {
    const selected = reduceEditor(loaded, { type: 'select', selection: { kind: 'edge', index: 1 } })
    const edges = mapFeatures(selected).features.filter((f) => f.properties?.kind === 'edge')
    expect(edges.map((f) => [f.properties?.road, f.properties?.selected])).toEqual([
      [false, false],
      [true, true],
      [false, false],
      [false, false],
    ])
  })

  it('draws an unfinished outline as an open path and flags the first corner once it can close', () => {
    const drawing = [[0, 0] as const, [1, 0] as const, [1, 1] as const].reduce(
      (s, at) => reduceEditor(s, { type: 'add', at }),
      initialEditorState('condo'),
    )
    const features = mapFeatures(drawing).features
    expect(features.filter((f) => f.properties?.kind === 'edge')).toHaveLength(2)
    expect(features.filter((f) => f.properties?.kind === 'area')).toHaveLength(0)
    expect(features.find((f) => f.properties?.kind === 'corner')?.properties?.closable).toBe(true)
  })
})

describe('mapLabels', () => {
  it('labels every corner and every road with its width', () => {
    const labels = mapLabels(loaded.draft)
    expect(labels.filter((l) => l.kind === 'corner').map((l) => l.text)).toEqual(['A', 'B', 'C', 'D'])
    expect(labels.filter((l) => l.kind === 'road')).toEqual([{ id: 'road-1', kind: 'road', at: [2, 1], text: '12.5\u00a0m' }])
  })

  it('labels a road without a width so it is visibly unfinished', () => {
    const marked = reduceEditor(loaded, { type: 'mark-road', edge: 2 })
    expect(mapLabels(marked.draft).find((l) => l.id === 'road-2')?.text).toBe('? m')
  })
})
