import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import type { LngLat } from '@/geo/projection'
import { BUILDING_TYPES, PlotSchema, type Plot } from '@/plot/plot'
import { initialEditorState, nextStep, reduceEditor, type EditorAction, type EditorState } from './editor-state'
import { MAX_CORNERS } from '@/plot/plot'

const BANGKOK: LngLat = [100.5636, 13.7466]
const STEP_DEGREES = 1e-4

const gridPoint = fc
  .tuple(fc.integer({ min: 0, max: 6 }), fc.integer({ min: 0, max: 6 }))
  .map(([i, j]): LngLat => [BANGKOK[0] + i * STEP_DEGREES, BANGKOK[1] + j * STEP_DEGREES])

const anywhere = fc.tuple(fc.double({ min: -200, max: 200 }), fc.double({ min: -100, max: 100 }))

const lngLat = fc.oneof({ weight: 6, arbitrary: gridPoint }, { weight: 1, arbitrary: anywhere })

const edgeIndex = fc.integer({ min: -2, max: MAX_CORNERS + 2 })
const cornerIndex = fc.integer({ min: -1, max: 9 })

const width = fc.oneof(
  { weight: 3, arbitrary: fc.double({ min: 3, max: 80, noNaN: true }) },
  { weight: 1, arbitrary: fc.constantFrom(0, -0, -5, Number.NaN, Infinity, -Infinity, 1e308, Number.MIN_VALUE) },
)

const rectangles = fc
  .record({
    origin: gridPoint,
    cols: fc.integer({ min: 1, max: 6 }),
    rows: fc.integer({ min: 1, max: 6 }),
    roadWidths: fc.array(fc.double({ min: 3, max: 80, noNaN: true }), { minLength: 1, maxLength: 4 }),
    buildingType: fc.constantFrom(...BUILDING_TYPES),
    nearStation: fc.boolean(),
  })
  .map(({ origin: [lng, lat], cols, rows, roadWidths, buildingType, nearStation }): Plot => {
    const [east, north] = [lng + cols * STEP_DEGREES, lat + rows * STEP_DEGREES]
    return {
      ring: [[lng, lat], [east, lat], [east, north], [lng, north]],
      roads: roadWidths.map((widthM, edge) => ({ edge, widthM })),
      buildingType,
      nearStation,
    }
  })

const action: fc.Arbitrary<EditorAction> = fc.oneof(
  { weight: 3, arbitrary: rectangles.map((plot): EditorAction => ({ type: 'load', plot })) },
  { weight: 6, arbitrary: lngLat.map((at): EditorAction => ({ type: 'add', at })) },
  { weight: 2, arbitrary: fc.constant<EditorAction>({ type: 'close' }) },
  { weight: 2, arbitrary: fc.constant<EditorAction>({ type: 'undo' }) },
  { weight: 1, arbitrary: fc.constant<EditorAction>({ type: 'clear' }) },
  { weight: 1, arbitrary: fc.constant<EditorAction>({ type: 'settle' }) },
  { weight: 4, arbitrary: fc.record({ type: fc.constant('move' as const), corner: cornerIndex, at: lngLat }) },
  { weight: 4, arbitrary: fc.record({ type: fc.constant('insert' as const), edge: cornerIndex, at: lngLat }) },
  { weight: 3, arbitrary: fc.record({ type: fc.constant('remove' as const), corner: cornerIndex }) },
  { weight: 3, arbitrary: fc.record({ type: fc.constant('mark-road' as const), edge: edgeIndex }) },
  { weight: 2, arbitrary: fc.record({ type: fc.constant('unmark-road' as const), edge: edgeIndex }) },
  { weight: 4, arbitrary: fc.record({ type: fc.constant('set-road-width' as const), edge: cornerIndex, widthM: width }) },
  { weight: 1, arbitrary: fc.record({ type: fc.constant('estimate-road-width' as const), edge: cornerIndex, widthM: width }) },
  { weight: 1, arbitrary: fc.record({ type: fc.constant('set-building-type' as const), buildingType: fc.constantFrom(...BUILDING_TYPES) }) },
  { weight: 1, arbitrary: fc.record({ type: fc.constant('set-near-station' as const), nearStation: fc.boolean() }) },
)

const sequences = fc.array(action, { maxLength: 60 })

function expectSelectionInside({ selection, draft }: EditorState) {
  if (selection.kind === 'none') return
  const count = draft.status === 'closed' ? draft.corners.length : draft.points.length
  expect(selection.index).toBeGreaterThanOrEqual(0)
  expect(selection.index).toBeLessThan(count)
}

function expectValidPlot({ plot, draft }: EditorState) {
  if (plot === null) return
  expect(PlotSchema.safeParse(plot).success).toBe(true)
  for (const road of plot.roads) expect(road.edge).toBeLessThan(plot.ring.length)
  expect(draft.status).toBe('closed')
}

function hasCompleteRoads({ draft }: EditorState) {
  if (draft.status !== 'closed') return false
  const roads = draft.corners.flatMap((c) => (c.edge.road ? [c.edge] : []))
  return roads.length > 0 && roads.every((e) => e.widthM !== null && e.widthM > 0)
}

describe('editor reducer fuzz', () => {
  it('never throws and only ever exposes a valid plot', () => {
    fc.assert(
      fc.property(sequences, (actions) => {
        let state = initialEditorState('condo')
        for (const next of actions) {
          state = reduceEditor(state, next)
          expectValidPlot(state)
          expectSelectionInside(state)
          nextStep(state)
        }
      }),
      { numRuns: 400 },
    )
  })

  it('exposes a plot whenever the closed draft has a road and every road has a width', () => {
    fc.assert(
      fc.property(sequences, (actions) => {
        const state = actions.reduce(reduceEditor, initialEditorState('condo'))
        expect(state.plot !== null).toBe(hasCompleteRoads(state))
      }),
      { numRuns: 400 },
    )
  })
})
