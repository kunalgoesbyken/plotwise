import type { BuildingType, Plot } from '@/plot/plot'
import { nearestRoad } from '@/site/nearest-road'
import type { Road as SiteRoad } from '@/site/schema'
import { editDraft, emptyDraft, toPlot, type Draft, type DraftAction, type Rejection } from './plot-draft'

export type Selection = { kind: 'none' } | { kind: 'corner'; index: number } | { kind: 'edge'; index: number }

export type EditorState = {
  draft: Draft
  plot: Plot | null
  selection: Selection
  notice: Rejection | null
  loads: number
  siteRoads: readonly SiteRoad[]
}

export type EditorAction =
  | DraftAction
  | { type: 'select'; selection: Selection }
  | { type: 'site-roads'; roads: readonly SiteRoad[] }

export type Step =
  | { step: 'start' }
  | { step: 'place' }
  | { step: 'close' }
  | { step: 'road' }
  | { step: 'width'; edge: number }
  | { step: 'done' }

const NONE: Selection = { kind: 'none' }

export function initialEditorState(buildingType: BuildingType): EditorState {
  return { draft: emptyDraft(buildingType), plot: null, selection: NONE, notice: null, loads: 0, siteRoads: [] }
}

function cornerCount(draft: Draft) {
  return draft.status === 'closed' ? draft.corners.length : draft.points.length
}

function selectionAfter(action: DraftAction, current: Selection, before: Draft, after: Draft): Selection {
  switch (action.type) {
    case 'settle':
      return cornerCount(before) === cornerCount(after) ? current : NONE
    case 'insert':
      return { kind: 'corner', index: action.edge + 1 }
    case 'mark-road':
      return { kind: 'edge', index: action.edge }
    case 'move':
    case 'set-road-width':
    case 'estimate-road-width':
    case 'set-building-type':
    case 'set-near-station':
      return current
    default:
      return NONE
  }
}

function withEstimate(draft: Draft, action: DraftAction, siteRoads: readonly SiteRoad[]): DraftAction | null {
  if (action.type !== 'mark-road' || draft.status !== 'closed') return null
  const { corners } = draft
  const start = corners[action.edge]
  if (!start) return null
  const nearest = nearestRoad([start.at, corners[(action.edge + 1) % corners.length].at], siteRoads)
  return nearest && { type: 'estimate-road-width', edge: action.edge, widthM: nearest.widthM }
}

function applyDraft(state: EditorState, action: DraftAction): EditorState {
  const result = editDraft(state.draft, action)
  if (!result.ok) return { ...state, notice: result.reason }
  if (result.draft === state.draft && state.notice === null) return state
  const estimate = withEstimate(result.draft, action, state.siteRoads)
  const estimated = estimate ? editDraft(result.draft, estimate) : result
  const draft = estimated.ok ? estimated.draft : result.draft
  return {
    ...state,
    draft,
    plot: draft === state.draft ? state.plot : toPlot(draft),
    selection: draft === state.draft ? state.selection : selectionAfter(action, state.selection, state.draft, draft),
    notice: null,
    loads: action.type === 'load' ? state.loads + 1 : state.loads,
  }
}

export function reduceEditor(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'select':
      return { ...state, selection: action.selection, notice: null }
    case 'site-roads':
      return { ...state, siteRoads: action.roads }
    default:
      return applyDraft(state, action)
  }
}

export function nextStep({ draft }: EditorState): Step {
  if (draft.status === 'drawing') {
    if (draft.points.length === 0) return { step: 'start' }
    return draft.points.length < 3 ? { step: 'place' } : { step: 'close' }
  }
  const unset = draft.corners.findIndex((c) => c.edge.road && c.edge.widthM === null)
  if (unset >= 0) return { step: 'width', edge: unset }
  return draft.corners.some((c) => c.edge.road) ? { step: 'done' } : { step: 'road' }
}
