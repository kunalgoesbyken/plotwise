import type { LngLat } from '@/geo/projection'
import type { BuildingType, Plot } from '@/plot/plot'
import { loadPack } from '@/rules'
import { nearestRoad } from '@/site/nearest-road'
import { nearestStation, type NearestStation } from '@/site/nearest-station'
import type { Road as SiteRoad, Station } from '@/site/schema'
import { satisfies, stationDistance } from '@/solve'
import type { Corner } from './outline'
import { editDraft, emptyDraft, toPlot, type Draft, type DraftAction, type Rejection } from './plot-draft'
import type { LinkProblem } from './plot-url'

export type Selection = { kind: 'none' } | { kind: 'corner'; index: number } | { kind: 'edge'; index: number }

export type Notice = Rejection | LinkProblem

export type Load = { source: 'link' | 'example'; count: number }

export type EditorState = {
  draft: Draft
  plot: Plot | null
  selection: Selection
  notice: Notice | null
  load: Load | null
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
  | { type: 'reject-link'; problem: LinkProblem }

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
    load: null,
    siteRoads: [],
    siteStations: null,
    nearestStation: null,
    focus: null,
  }
}

function cornerCount(draft: Draft) {
  return draft.status === 'closed' ? draft.corners.length : draft.points.length
}

function firstRoad(draft: Draft): Selection {
  if (draft.status !== 'closed') return NONE
  const index = draft.corners.findIndex((corner) => corner.edge.road)
  return index < 0 ? NONE : { kind: 'edge', index }
}

function selectionAfter(action: DraftAction, current: Selection, before: Draft, after: Draft): Selection {
  switch (action.type) {
    case 'load-example':
      return firstRoad(after)
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

function mappedWidth(corners: readonly Corner[], edge: number, siteRoads: readonly SiteRoad[]): number | null {
  const start = corners[edge]
  if (!start) return null
  return nearestRoad([start.at, corners[(edge + 1) % corners.length].at], siteRoads)?.widthM ?? null
}

function withEstimate(draft: Draft, action: DraftAction, siteRoads: readonly SiteRoad[]): DraftAction | null {
  if (action.type !== 'mark-road' || draft.status !== 'closed') return null
  const widthM = mappedWidth(draft.corners, action.edge, siteRoads)
  return widthM === null ? null : { type: 'estimate-road-width', edge: action.edge, widthM }
}

function loadAfter(current: Load | null, action: DraftAction): Load | null {
  const count = (current?.count ?? 0) + 1
  if (action.type === 'load') return { source: 'link', count }
  return action.type === 'load-example' ? { source: 'example', count } : current
}

function applyDraft(state: EditorState, action: DraftAction): EditorState {
  const result = editDraft(state.draft, action)
  if (!result.ok) return { ...state, notice: action.type === 'load' ? 'link-invalid' : result.reason }
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
    load: loadAfter(state.load, action),
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

function sameFrontageInputs(before: EditorState, after: EditorState): boolean {
  return (
    before.siteRoads === after.siteRoads &&
    before.draft.status === 'closed' &&
    after.draft.status === 'closed' &&
    before.draft.corners === after.draft.corners
  )
}

function withFrontageEstimates(before: EditorState, after: EditorState): EditorState {
  const { draft, siteRoads } = after
  if (draft.status !== 'closed' || siteRoads.length === 0 || sameFrontageInputs(before, after)) return after
  const estimated = [...draft.corners.keys()].reduce<Draft>((current, edge) => {
    const widthM = mappedWidth(draft.corners, edge, siteRoads)
    if (widthM === null) return current
    const result = editDraft(current, { type: 'estimate-road', edge, widthM })
    return result.ok ? result.draft : current
  }, draft)
  return estimated === draft ? after : { ...after, draft: estimated, plot: toPlot(estimated) }
}

function reduceAction(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'select':
      return { ...state, selection: action.selection, notice: null }
    case 'site':
      return { ...state, siteRoads: action.roads, siteStations: action.stations }
    case 'reject-link':
      return { ...state, notice: action.problem }
    case 'focus':
      return { ...state, focus: { at: action.at, requests: (state.focus?.requests ?? 0) + 1 } }
    default:
      return applyDraft(state, action)
  }
}

export function reduceEditor(state: EditorState, action: EditorAction): EditorState {
  const next = reduceAction(state, action)
  return next === state ? state : withStationEstimate(state, withFrontageEstimates(state, next))
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
