import type { LngLat } from '@/geo/projection'
import type { BuildingType, Plot } from '@/plot/plot'
import { DEFAULT_REGION, isExampleSite, REGIONS } from '@/region/regions'
import { loadPack, type RulePack } from '@/rules'
import { nearestRoad } from '@/site/nearest-road'
import { nearestStation, type NearestStation } from '@/site/nearest-station'
import type { Road as SiteRoad, Station } from '@/site/schema'
import { plotLimitFields, satisfies, stationDistance, type RegionId } from '@/solve'
import type { Corner } from './outline'
import { editDraft, emptyDraft, toPlot, type Draft, type DraftAction, type Rejection } from './plot-draft'
import type { LinkProblem } from './plot-url'

export type Selection = { kind: 'none' } | { kind: 'corner'; index: number } | { kind: 'edge'; index: number }

export type Notice = Rejection | LinkProblem

export type Load = { source: 'link' | 'example' | 'import'; count: number }

export type EditorState = {
  region: RegionId
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
  | Exclude<DraftAction, { type: 'load' }>
  | { type: 'load'; plot: Plot }
  | { type: 'select'; selection: Selection }
  | { type: 'site'; roads: readonly SiteRoad[]; stations: readonly Station[] | null }
  | { type: 'focus'; at: LngLat }
  | { type: 'reject-link'; problem: LinkProblem }
  | { type: 'set-region'; region: RegionId }

export type Step =
  | { step: 'start' }
  | { step: 'place' }
  | { step: 'close' }
  | { step: 'road' }
  | { step: 'width'; edge: number }
  | { step: 'done' }

const NONE: Selection = { kind: 'none' }

export function initialEditorState(buildingType: BuildingType): EditorState {
  return {
    region: DEFAULT_REGION.id,
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
    case 'set-limit':
    case 'set-prescribed-width':
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
  switch (action.type) {
    case 'load':
      return { source: 'link', count }
    case 'load-example':
      return { source: 'example', count }
    case 'import':
      return { source: 'import', count }
    default:
      return current
  }
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

function isNearStation(region: RegionId, nearest: NearestStation | null): boolean {
  const limit = stationDistance(loadPack(REGIONS[region].packId))
  return limit !== null && nearest !== null && satisfies(nearest.distanceM, limit)
}

function sameStationInputs(before: EditorState, after: EditorState): boolean {
  return (
    before.region === after.region &&
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
  const estimated = editDraft(draft, { type: 'estimate-near-station', nearStation: isNearStation(after.region, nearest) })
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
    const result = editDraft(current, { type: 'estimate-road', edge, widthM })
    return result.ok ? result.draft : current
  }, draft)
  return estimated === draft ? after : { ...after, draft: estimated, plot: toPlot(estimated) }
}

function linkedLoad(id: RegionId, plot: Plot): DraftAction {
  const region = REGIONS[id]
  return { type: 'load', plot, roadsEstimated: isExampleSite(region, plot.ring) && region.example?.roadsEstimated === true }
}

function reduceAction(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'load':
      return applyDraft(state, linkedLoad(state.region, action.plot))
    case 'select':
      return { ...state, selection: action.selection, notice: null }
    case 'site':
      return { ...state, siteRoads: action.roads, siteStations: action.stations }
    case 'set-region':
      return action.region === state.region ? state : { ...state, region: action.region }
    case 'reject-link':
      return { ...state, notice: action.problem }
    case 'focus':
      return { ...state, focus: { at: action.at, requests: (state.focus?.requests ?? 0) + 1 } }
    default:
      return applyDraft(state, action)
  }
}

function takenLimits(pack: RulePack, draft: Draft): Draft {
  const taken = new Set<string>(plotLimitFields(pack))
  const kept = Object.entries(draft.limits).filter(([field]) => taken.has(field))
  return kept.length === Object.keys(draft.limits).length ? draft : { ...draft, limits: Object.fromEntries(kept) }
}

function coveredBuildingType(pack: RulePack, draft: Draft): Draft {
  const covered = pack.buildingTypes
  return !covered || covered.includes(draft.buildingType) ? draft : { ...draft, buildingType: covered[0] }
}

const widensPerFrontage = (pack: RulePack) => (pack.reservations ?? []).some((r) => r.target.kind === 'perFrontage')

function takenWidenings(pack: RulePack, draft: Draft): Draft {
  if (draft.status !== 'closed' || widensPerFrontage(pack) || !draft.corners.some((c) => c.edge.road && c.edge.prescribedWidthM !== undefined)) return draft
  const corners = draft.corners.map((corner) => {
    if (!corner.edge.road) return corner
    const { prescribedWidthM: dropped, ...edge } = corner.edge
    return dropped === undefined ? corner : { ...corner, edge }
  })
  return { ...draft, corners }
}

function withRegionInputs(state: EditorState): EditorState {
  const pack = loadPack(REGIONS[state.region].packId)
  const draft = takenWidenings(pack, coveredBuildingType(pack, takenLimits(pack, state.draft)))
  return draft === state.draft ? state : { ...state, draft, plot: toPlot(draft) }
}

export function reduceEditor(state: EditorState, action: EditorAction): EditorState {
  const next = reduceAction(state, action)
  return next === state ? state : withStationEstimate(state, withFrontageEstimates(state, withRegionInputs(next)))
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
