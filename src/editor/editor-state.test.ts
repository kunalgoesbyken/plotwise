import { describe, expect, it } from 'bun:test'
import { localFrame } from '@/geo/projection'
import type { Plot } from '@/plot/plot'
import { loadPack } from '@/rules'
import type { Road as SiteRoad, Station } from '@/site/schema'
import { stationDistance } from '@/solve'
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

  it('does not select a corner or edge that an ignored edit never created', () => {
    const refused = run({ type: 'close' })
    expect(refused.notice).toBe('too-few-corners')
    expect(reduceEditor(refused, { type: 'insert', edge: 0, at: [0, 0] }).selection).toEqual({ kind: 'none' })
    const refusedOnPlot = run({ type: 'load', plot }, { type: 'remove', corner: 9 }, { type: 'select', selection: { kind: 'none' } })
    expect(reduceEditor(refusedOnPlot, { type: 'mark-road', edge: 9 }).selection).toEqual({ kind: 'none' })
  })

  it('keeps the selection when the station flag changes', () => {
    const selected = run({ type: 'load', plot }, { type: 'select', selection: { kind: 'edge', index: 0 } })
    const near = reduceEditor(selected, { type: 'set-near-station', nearStation: true })
    expect(near.selection).toEqual({ kind: 'edge', index: 0 })
    expect(near.plot?.nearStation).toBe(true)
  })

  it('counts loads so the map knows when to frame a new plot', () => {
    expect(run({ type: 'load', plot }, { type: 'mark-road', edge: 2 }, { type: 'load', plot }).load).toEqual({ source: 'link', count: 2 })
  })

  it('closes an imported outline with no roads, selects nothing and counts it as a load for the map to frame', () => {
    const state = run({ type: 'add', at: [5, 5] }, { type: 'import', ring: plot.ring })
    expect(state.draft.status).toBe('closed')
    expect(state.plot).toBeNull()
    expect(state.selection).toEqual({ kind: 'none' })
    expect(state.load).toEqual({ source: 'import', count: 1 })
    expect(nextStep(state)).toEqual({ step: 'road' })
  })

  it('asks the map to go to a searched place, again even when it is the same place, without touching the plot', () => {
    const loaded = run({ type: 'load', plot })
    const first = reduceEditor(loaded, { type: 'focus', at: [100.53, 13.73] })
    const again = reduceEditor(first, { type: 'focus', at: [100.53, 13.73] })
    expect(first.focus).toEqual({ at: [100.53, 13.73], requests: 1 })
    expect(again.focus?.requests).toBe(2)
    expect(again.plot).toBe(loaded.plot)
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
    oneway: false,
  }

  it('fills a newly marked road with the nearest mapped road width, marked as an estimate', () => {
    const state = run({ type: 'load', plot: lot }, { type: 'site', roads: [soi], stations: [] }, { type: 'mark-road', edge: 2 })
    expect(state.draft.status === 'closed' && state.draft.corners[2].edge).toEqual({ road: true, widthM: 8, estimated: true })
    expect(state.plot?.roads).toEqual([
      { edge: 0, widthM: 12 },
      { edge: 2, widthM: 8 },
    ])
  })

  it('marks the edges of an imported outline beside a mapped road like a drawn one', () => {
    const imported = run({ type: 'import', ring: lot.ring }, { type: 'site', roads: [soi], stations: [] })
    expect(imported.draft.status === 'closed' && imported.draft.corners[2].edge).toEqual({ road: true, widthM: 8, estimated: true })
    expect(imported.plot?.roads).toEqual([{ edge: 2, widthM: 8 }])
  })

  it('marks untouched edges beside a mapped road when the outline closes or the roads arrive', () => {
    const drawn: EditorAction[] = [...lot.ring.map((at): EditorAction => ({ type: 'add', at })), { type: 'close' }]
    const after = run(...drawn, { type: 'site', roads: [soi], stations: [] })
    expect(after.draft.status === 'closed' && after.draft.corners[2].edge).toEqual({ road: true, widthM: 8, estimated: true })
    expect(after.plot?.roads).toEqual([{ edge: 2, widthM: 8 }])
    const before = run({ type: 'site', roads: [soi], stations: [] }, ...drawn)
    expect(before.draft).toEqual(after.draft)
  })

  it('re-estimates an estimated road when the mapped roads change, and drops it when no road runs along the edge', () => {
    const drawn: EditorAction[] = [...lot.ring.map((at): EditorAction => ({ type: 'add', at })), { type: 'close' }]
    const wider: SiteRoad = { ...soi, id: 'wider', widthM: 10 }
    const elsewhere: SiteRoad = { ...soi, id: 'elsewhere', line: [frame.toLngLat([300, 300]), frame.toLngLat([360, 300])] }
    const updated = run(...drawn, { type: 'site', roads: [soi], stations: [] }, { type: 'site', roads: [wider], stations: [] })
    expect(updated.plot?.roads).toEqual([{ edge: 2, widthM: 10 }])
    const gone = run(...drawn, { type: 'site', roads: [soi], stations: [] }, { type: 'site', roads: [elsewhere], stations: [] })
    expect(gone.plot).toBeNull()
  })

  it('never overrides what the user or a shared link decided about an edge', () => {
    const link = run({ type: 'load', plot: lot }, { type: 'site', roads: [soi], stations: [] })
    expect(link.plot?.roads).toEqual(lot.roads)
    const drawn: EditorAction[] = [...lot.ring.map((at): EditorAction => ({ type: 'add', at })), { type: 'close' }]
    const removed = run(...drawn, { type: 'site', roads: [soi], stations: [] }, { type: 'unmark-road', edge: 2 }, { type: 'site', roads: [soi], stations: [] })
    expect(removed.plot).toBeNull()
    const typed = run(...drawn, { type: 'site', roads: [soi], stations: [] }, { type: 'set-road-width', edge: 2, widthM: 11 }, { type: 'site', roads: [soi], stations: [] })
    expect(typed.plot?.roads).toEqual([{ edge: 2, widthM: 11 }])
  })

  it('selects the example’s road and tells a link load from an example load', () => {
    const example = run({ type: 'load-example', plot: lot })
    expect(example.selection).toEqual({ kind: 'edge', index: 0 })
    expect(example.load?.source).toBe('example')
    expect(run({ type: 'load', plot: lot }).load?.source).toBe('link')
  })

  it('keeps a notice when a link’s outline cannot be loaded', () => {
    const crossed = { ...lot, ring: [lot.ring[0], lot.ring[2], lot.ring[1], lot.ring[3]] }
    expect(run({ type: 'load', plot: crossed }).notice).toBe('link-invalid')
    expect(run({ type: 'reject-link', problem: 'link-incomplete' }).notice).toBe('link-incomplete')
  })

  it('leaves the width empty when no mapped road runs along the edge', () => {
    const state = run({ type: 'load', plot: lot }, { type: 'site', roads: [soi], stations: [] }, { type: 'mark-road', edge: 1 })
    expect(state.draft.status === 'closed' && state.draft.corners[1].edge).toEqual({ road: true, widthM: null, estimated: false })
  })
})

describe('station distance estimates', () => {
  const frame = localFrame([100.5603, 13.737])
  const limitM = stationDistance(loadPack('bkk-y9'))!.value
  const corners: [number, number][] = [
    [0, 0],
    [40, 0],
    [40, 30],
    [0, 30],
  ]
  const draw: EditorAction[] = [
    ...corners.map(([x, y]): EditorAction => ({ type: 'add', at: frame.toLngLat([x, y]) })),
    { type: 'close' },
    { type: 'mark-road', edge: 0 },
    { type: 'set-road-width', edge: 0, widthM: 12 },
  ]
  const platformAt = (y: number): Station => ({
    id: 'platform',
    kind: 'platform',
    geometry: { type: 'line', line: [frame.toLngLat([0, y]), frame.toLngLat([40, y])] },
  })
  const asok: Station = { id: 'asok', name: 'Asok', kind: 'station', geometry: { type: 'point', at: frame.toLngLat([20, 30 + limitM - 1]) } }
  const site = (stations: Station[] | null): EditorAction => ({ type: 'site', roads: [], stations })

  it('pre-sets the flag as an estimate when the nearest platform is within the limit', () => {
    const state = run(...draw, site([platformAt(30 + limitM - 1)]))
    expect(state.nearestStation).toEqual({ distanceM: expect.closeTo(limitM - 1, 3), measuredFrom: 'platform' })
    expect(state.draft).toMatchObject({ nearStation: true, nearStationSource: 'estimate' })
    expect(state.plot?.nearStation).toBe(true)
  })

  it('falls back to a station point and leaves the flag off past the limit', () => {
    const near = run(...draw, site([asok]))
    expect(near.nearestStation).toEqual({ name: 'Asok', distanceM: expect.closeTo(limitM - 1, 3), measuredFrom: 'station' })
    expect(near.draft.nearStation).toBe(true)
    const far = run(...draw, site([platformAt(30 + limitM + 1)]))
    expect(far.draft).toMatchObject({ nearStation: false, nearStationSource: 'estimate' })
  })

  it('re-estimates when a corner moves', () => {
    const state = run(...draw, site([platformAt(30 + limitM + 1)]), { type: 'move', corner: 2, at: frame.toLngLat([40, 32]) })
    expect(state.draft.nearStation).toBe(true)
  })

  it('keeps the user choice when station data arrives or the plot changes', () => {
    const chosen = run(...draw, { type: 'set-near-station', nearStation: false }, site([asok]))
    expect(chosen.draft).toMatchObject({ nearStation: false, nearStationSource: 'user' })
    expect(chosen.nearestStation?.name).toBe('Asok')
  })

  it('keeps the flag of a loaded plot but still reports the nearest station', () => {
    const ring = corners.map(([x, y]) => [...frame.toLngLat([x, y])] as [number, number])
    const state = run({ type: 'load', plot: { ...plot, ring } }, site([asok]))
    expect(state.draft.nearStation).toBe(false)
    expect(state.nearestStation?.measuredFrom).toBe('station')
  })

  it('estimates the flag for the example plot, which is nobody’s choice, and frames it like any load', () => {
    const ring = corners.map(([x, y]) => [...frame.toLngLat([x, y])] as [number, number])
    const state = run({ type: 'load-example', plot: { ...plot, ring } }, site([asok]))
    expect(state.draft).toMatchObject({ nearStation: true, nearStationSource: 'estimate' })
    expect(state.load).toEqual({ source: 'example', count: 1 })
  })

  it('makes no estimate until station data is known, and forgets it when the plot is cleared', () => {
    const unknown = run(...draw, site(null))
    expect(unknown.nearestStation).toBeNull()
    expect(unknown.draft.nearStationSource).toBe('default')
    const cleared = run(...draw, site([asok]), { type: 'clear' })
    expect(cleared.nearestStation).toBeNull()
    expect(cleared.draft).toMatchObject({ nearStation: false, nearStationSource: 'default' })
  })

  it('estimates no station when none is mapped nearby', () => {
    const state = run(...draw, site([]))
    expect(state.nearestStation).toBeNull()
    expect(state.draft).toMatchObject({ nearStation: false, nearStationSource: 'estimate' })
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
