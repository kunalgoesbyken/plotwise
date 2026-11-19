import { describe, expect, it } from 'bun:test'
import { localFrame } from '@/geo/projection'
import type { Plot } from '@/plot/plot'
import type { Road as SiteRoad } from '@/site/schema'
import { initialEditorState, reduceEditor, nextStep, type EditorAction, type EditorState } from './editor-state'

const plot: Plot = {
  ring: [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ],
  roads: [{ edge: 0, widthM: 12 }],
  buildingType: 'condo',
  nearStation: false,
}

function run(...actions: EditorAction[]) {
  return actions.reduce<EditorState>(reduceEditor, initialEditorState('condo'))
}

describe('reduceEditor', () => {
  it('derives the validated plot from the draft', () => {
    expect(run().plot).toBeNull()
    expect(run({ type: 'load', plot }).plot).toEqual(plot)
  })

  it('keeps the same plot object when only the selection changes', () => {
    const loaded = run({ type: 'load', plot })
    const selected = reduceEditor(loaded, { type: 'select', selection: { kind: 'corner', index: 2 } })
    expect(selected.plot).toBe(loaded.plot)
    expect(selected.selection).toEqual({ kind: 'corner', index: 2 })
  })

  it('records why an edit was refused and clears it on the next accepted edit', () => {
    const triangle = { ...plot, ring: plot.ring.slice(0, 3) }
    const refused = run({ type: 'load', plot: triangle }, { type: 'remove', corner: 0 })
    expect(refused.notice).toBe('too-few-corners')
    expect(refused.plot).toEqual(triangle)
    expect(reduceEditor(refused, { type: 'set-building-type', buildingType: 'hotel' }).notice).toBeNull()
  })

  it('selects the inserted corner and the newly marked road', () => {
    expect(run({ type: 'load', plot }, { type: 'insert', edge: 1, at: [1.2, 0.5] }).selection).toEqual({
      kind: 'corner',
      index: 2,
    })
    expect(run({ type: 'load', plot }, { type: 'mark-road', edge: 2 }).selection).toEqual({ kind: 'edge', index: 2 })
  })

  it('drops the selection when corners are removed or the plot is cleared', () => {
    const square: Plot = { ...plot, ring: [...plot.ring, [-0.5, 0.5]] }
    const selected: EditorAction = { type: 'select', selection: { kind: 'corner', index: 4 } }
    expect(run({ type: 'load', plot: square }, selected, { type: 'remove', corner: 4 }).selection).toEqual({ kind: 'none' })
    expect(run({ type: 'load', plot }, selected, { type: 'clear' }).selection).toEqual({ kind: 'none' })
  })

  it('keeps the selection when the station flag changes', () => {
    const selected = run({ type: 'load', plot }, { type: 'select', selection: { kind: 'edge', index: 0 } })
    const near = reduceEditor(selected, { type: 'set-near-station', nearStation: true })
    expect(near.selection).toEqual({ kind: 'edge', index: 0 })
    expect(near.plot?.nearStation).toBe(true)
  })

  it('counts loads so the map knows when to frame a new plot', () => {
    expect(run({ type: 'load', plot }, { type: 'mark-road', edge: 2 }, { type: 'load', plot }).loads).toBe(2)
  })

  it('returns the same state for a no-op', () => {
    const state = run({ type: 'load', plot })
    expect(reduceEditor(state, { type: 'unmark-road', edge: 3 })).toBe(state)
  })
})

describe('road width estimates', () => {
  const frame = localFrame([100.53, 13.724])
  const lot: Plot = {
    ring: [
      [0, 0],
      [40, 0],
      [40, 30],
      [0, 30],
    ].map(([x, y]) => [...frame.toLngLat([x, y])] as [number, number]),
    roads: [{ edge: 0, widthM: 12 }],
    buildingType: 'condo',
    nearStation: false,
  }
  const soi: SiteRoad = {
    id: 'soi',
    line: [frame.toLngLat([-10, 38]), frame.toLngLat([50, 38])],
    highway: 'residential',
    widthM: 8,
    widthSource: 'lanes',
    grade: 'ground',
  }

  it('fills a newly marked road with the nearest mapped road width, marked as an estimate', () => {
    const state = run({ type: 'load', plot: lot }, { type: 'site-roads', roads: [soi] }, { type: 'mark-road', edge: 2 })
    expect(state.draft.status === 'closed' && state.draft.corners[2].edge).toEqual({ road: true, widthM: 8, estimated: true })
    expect(state.plot?.roads).toEqual([
      { edge: 0, widthM: 12 },
      { edge: 2, widthM: 8 },
    ])
  })

  it('leaves the width empty when no mapped road runs along the edge', () => {
    const state = run({ type: 'load', plot: lot }, { type: 'site-roads', roads: [soi] }, { type: 'mark-road', edge: 1 })
    expect(state.draft.status === 'closed' && state.draft.corners[1].edge).toEqual({ road: true, widthM: null, estimated: false })
  })
})

describe('nextStep', () => {
  it('walks from drawing to a complete plot', () => {
    expect(nextStep(run())).toEqual({ step: 'start' })
    expect(nextStep(run({ type: 'add', at: [0, 0] }))).toEqual({ step: 'place' })
    expect(nextStep(run({ type: 'add', at: [0, 0] }, { type: 'add', at: [1, 0] }, { type: 'add', at: [1, 1] }))).toEqual({
      step: 'close',
    })
    const closed = run({ type: 'load', plot }, { type: 'unmark-road', edge: 0 })
    expect(nextStep(closed)).toEqual({ step: 'road' })
    expect(nextStep(reduceEditor(closed, { type: 'mark-road', edge: 1 }))).toEqual({ step: 'width', edge: 1 })
    expect(nextStep(run({ type: 'load', plot }))).toEqual({ step: 'done' })
  })
})
