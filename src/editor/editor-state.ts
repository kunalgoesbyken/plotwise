import type { LngLat } from '@/geo/projection'
import type { BuildingType, Plot } from '@/plot/plot'
import { loadPack } from '@/rules'
import { nearestRoad } from '@/site/nearest-road'
import { nearestStation, type NearestStation } from '@/site/nearest-station'
import type { Road as SiteRoad, Station } from '@/site/schema'
import { satisfies, stationDistance } from '@/solve'
import { editDraft, emptyDraft, toPlot, type Draft, type DraftAction, type Rejection } from './plot-draft'

export type Selection = { kind: 'none' } | { kind: 'corner'; index: number } | { kind: 'edge'; index: number }

export type EditorState = {
  draft: Draft
  plot: Plot | null
  selection: Selection
  notice: Rejection | null
  loads: number
  siteRoads: readonly SiteRoad[]
  siteStations: readonly Station[] | null
  nearestStation: NearestStation | null
  focus: { at: LngLat; requests: number } | null
}

export type EditorAction =
  | DraftAction
  | { type: 'select'; selection: Selection }
  | { type: 'site'; roads: readonly SiteRoad[]; stations: readonly Station[] | null }
  | { type: 'focus'; at: LngLat }

export type Step =
  | { step: 'start' }
  | { step: 'place' }
  | { step: 'close' }
  | { step: 'road' }
  | { step: 'width'; edge: number }
  | { step: 'done' }

const NONE: Selection = { kind: 'none' }
const STATION_DISTANCE = stationDistance(loadPack('bkk-y9'))

export function initialEditorState(buildingType: BuildingType): EditorState {
  return {
    draft: emptyDraft(buildingType),
    plot: null,
    selection: NONE,
    notice: null,
    loads: 0,
    siteRoads: [],
    siteStations: null,
    nearestStation: null,
    focus: null,
  }
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
    case 'estimate-near-station':
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
    loads: action.type === 'load' || action.type === 'load-example' ? state.loads + 1 : state.loads,
  }
}

function isNearStation(nearest: NearestStation | null): boolean {
  return nearest !== null && satisfies(nearest.distanceM, STATION_DISTANCE)
}

function sameStationInputs(before: EditorState, after: EditorState): boolean {
  return (
    before.siteStations === after.siteStations &&
    before.draft.status === 'closed' &&
    after.draft.status === 'closed' &&
    before.draft.corners === after.draft.corners
  )
}

function withStationEstimate(before: EditorState, after: EditorState): EditorState {
  const { draft, siteStations } = after
  if (draft.status !== 'closed' || siteStations === null) return after.nearestStation ? { ...after, nearestStation: null } : after
  if (sameStationInputs(before, after)) return after
  const nearest = nearestStation(draft.corners.map((corner) => corner.at), siteStations)
  const estimated = editDraft(draft, { type: 'estimate-near-station', nearStation: isNearStation(nearest) })
  const next = estimated.ok ? estimated.draft : draft
  return { ...after, draft: next, plot: next === draft ? after.plot : toPlot(next), nearestStation: nearest }
}

function reduceAction(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'select':
      return { ...state, selection: action.selection, notice: null }
    case 'site':
      return { ...state, siteRoads: action.roads, siteStations: action.stations }
    case 'focus':
      return { ...state, focus: { at: action.at, requests: (state.focus?.requests ?? 0) + 1 } }
    default:
      return applyDraft(state, action)
  }
}

export function reduceEditor(state: EditorState, action: EditorAction): EditorState {
  const next = reduceAction(state, action)
  return next === state ? state : withStationEstimate(state, next)
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
