import { describe, expect, it } from 'bun:test'
import type { Plot } from '@/plot/plot'
import { initialEditorState, reduceEditor, type EditorAction, type EditorState } from './editor-state'
import { followEdits, furthestStep, isOpen, shownStep } from './steps'

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

const run = (...actions: EditorAction[]) => actions.reduce<EditorState>(reduceEditor, initialEditorState('condo'))
const triangle: EditorAction[] = [
  { type: 'add', at: [0, 0] },
  { type: 'add', at: [0.001, 0] },
  { type: 'add', at: [0.001, 0.001] },
]

describe('furthestStep', () => {
  it('opens roads once the outline is closed and results once the plot is complete', () => {
    expect(furthestStep(run())).toBe('plot')
    expect(furthestStep(run(...triangle))).toBe('plot')
    expect(furthestStep(run(...triangle, { type: 'close' }))).toBe('roads')
    expect(furthestStep(run({ type: 'load', plot }))).toBe('results')
  })

  it('opens every step up to the furthest and none after it', () => {
    const closed = run(...triangle, { type: 'close' })
    expect(isOpen('plot', closed)).toBe(true)
    expect(isOpen('roads', closed)).toBe(true)
    expect(isOpen('results', closed)).toBe(false)
  })
})

describe('followEdits', () => {
  it('moves to roads when the outline closes and back to plot when it is cleared', () => {
    const drawing = run(...triangle)
    const closed = reduceEditor(drawing, { type: 'close' })
    expect(followEdits('plot', drawing, closed)).toBe('roads')
    expect(followEdits('roads', closed, reduceEditor(closed, { type: 'clear' }))).toBe('plot')
  })

  it('shows the results of a loaded or example plot straight away', () => {
    const empty = run()
    expect(followEdits('plot', empty, reduceEditor(empty, { type: 'load', plot }))).toBe('results')
    expect(followEdits('plot', empty, reduceEditor(empty, { type: 'load-example', plot }))).toBe('results')
  })

  it('opens roads when an edge is picked on the map, but not when the same edge stays selected', () => {
    const loaded = run({ type: 'load', plot })
    const picked = reduceEditor(loaded, { type: 'select', selection: { kind: 'edge', index: 2 } })
    expect(followEdits('results', loaded, picked)).toBe('roads')
    const widened = reduceEditor(picked, { type: 'set-road-width', edge: 0, widthM: 20 })
    expect(followEdits('results', picked, widened)).toBe('results')
  })

  it('stays put for edits that do not change where the user is', () => {
    const loaded = run({ type: 'load', plot })
    expect(followEdits('results', loaded, reduceEditor(loaded, { type: 'set-building-type', buildingType: 'hotel' }))).toBe('results')
  })
})

describe('shownStep', () => {
  it('falls back to the furthest open step when the chosen one is not open', () => {
    const loaded = run({ type: 'load', plot })
    const noWidth = reduceEditor(loaded, { type: 'unmark-road', edge: 0 })
    expect(shownStep('results', noWidth)).toBe('roads')
    expect(shownStep('plot', noWidth)).toBe('plot')
  })
})
