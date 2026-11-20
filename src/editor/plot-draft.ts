import type { LngLat } from '@/geo/projection'
import { MAX_CORNERS, PlotLimitsSchema, PlotSchema, RoadWidthSchema, type BuildingType, type Plot, type PlotLimitField, type PlotLimits, type Road } from '@/plot/plot'
import type { RegionExample } from '@/region/regions'
import { checkOutline, isOnEarth, NEIGHBOUR, normalizeOutline, SIDE, type Corner, type Edge, type OutlineRejection, type RoadEdge } from './outline'
import { isSimplePath } from './path'

const COORDINATE_SCALE = 1e7

export type NearStationSource = 'default' | 'estimate' | 'user'

type Brief = { buildingType: BuildingType; nearStation: boolean; nearStationSource: NearStationSource; limits: PlotLimits }

export type Draft =
  | ({ status: 'drawing'; points: readonly LngLat[] } & Brief)
  | ({ status: 'closed'; corners: readonly Corner[] } & Brief)

export type DraftAction =
  | { type: 'add'; at: LngLat }
  | { type: 'undo' }
  | { type: 'close' }
  | { type: 'move'; corner: number; at: LngLat }
  | { type: 'insert'; edge: number; at: LngLat }
  | { type: 'settle' }
  | { type: 'remove'; corner: number }
  | { type: 'mark-road'; edge: number }
  | { type: 'unmark-road'; edge: number }
  | { type: 'set-road-width'; edge: number; widthM: number }
  | { type: 'set-prescribed-width'; edge: number; prescribedWidthM: number | undefined }
  | { type: 'estimate-road-width'; edge: number; widthM: number }
  | { type: 'estimate-road'; edge: number; widthM: number | null }
  | { type: 'set-building-type'; buildingType: BuildingType }
  | { type: 'set-near-station'; nearStation: boolean }
  | { type: 'estimate-near-station'; nearStation: boolean }
  | { type: 'set-limit'; field: PlotLimitField; value: number | undefined }
  | { type: 'clear' }
  | { type: 'load'; plot: Plot }
  | { type: 'load-example'; example: Pick<RegionExample, 'plot' | 'roadsEstimated'> }
  | { type: 'import'; ring: readonly LngLat[] }

export type Rejection = OutlineRejection | 'too-few-corners' | 'too-many-corners'
export type EditResult = { ok: true; draft: Draft } | { ok: false; reason: Rejection }

type ClosedDraft = Extract<Draft, { status: 'closed' }>
type DrawingDraft = Extract<Draft, { status: 'drawing' }>

export function emptyDraft(buildingType: BuildingType): Draft {
  return { status: 'drawing', points: [], buildingType, nearStation: false, nearStationSource: 'default', limits: {} }
}

function roundCoordinate(value: number) {
  return Math.round(value * COORDINATE_SCALE) / COORDINATE_SCALE || 0
}

export function roundLngLat([lng, lat]: LngLat): [number, number] {
  return [roundCoordinate(lng), roundCoordinate(lat)]
}

const isRoadWidth = (widthM: number) => RoadWidthSchema.safeParse(widthM).success

function roadOf(widthM: number | null, estimated: boolean, prescribedWidthM: number | undefined): RoadEdge {
  const widens = prescribedWidthM !== undefined && (widthM === null || prescribedWidthM > widthM)
  return widens ? { road: true, widthM, estimated, prescribedWidthM } : { road: true, widthM, estimated }
}

const accept = (draft: Draft): EditResult => ({ ok: true, draft })
const reject = (reason: Rejection): EditResult => ({ ok: false, reason })

function closed(brief: Brief, corners: readonly Corner[]): EditResult {
  if (corners.length < 3) return reject('too-few-corners')
  if (corners.length > MAX_CORNERS) return reject('too-many-corners')
  const outline = normalizeOutline(corners)
  const { buildingType, nearStation, nearStationSource, limits } = brief
  if (!outline.ok) return reject(outline.reason)
  return accept({ status: 'closed', corners: outline.corners, buildingType, nearStation, nearStationSource, limits })
}

function reshaped(draft: ClosedDraft, corners: Corner[]): EditResult {
  const rejection = checkOutline(corners)
  return rejection ? reject(rejection) : accept({ ...draft, corners })
}

function editDrawing(draft: DrawingDraft, action: DraftAction): EditResult {
  const { points } = draft
  switch (action.type) {
    case 'add': {
      if (points.length >= MAX_CORNERS) return reject('too-many-corners')
      if (!isOnEarth(action.at)) return reject('out-of-range')
      const next = [...points, action.at]
      return isSimplePath(next) ? accept({ ...draft, points: next }) : reject('crossing')
    }
    case 'undo':
      return accept({ ...draft, points: points.slice(0, -1) })
    case 'close':
      return closed(draft, points.map((at) => ({ at, edge: SIDE })))
    default:
      return accept(draft)
  }
}

function replaceEdge(draft: ClosedDraft, index: number, edit: (edge: Edge) => Edge): EditResult {
  const corner = draft.corners[index]
  if (!corner) return accept(draft)
  const edge = edit(corner.edge)
  if (edge === corner.edge) return accept(draft)
  return accept({ ...draft, corners: draft.corners.with(index, { ...corner, edge }) })
}

function editClosed(draft: ClosedDraft, action: DraftAction): EditResult {
  const { corners } = draft
  switch (action.type) {
    case 'move': {
      const corner = corners[action.corner]
      if (!corner) return accept(draft)
      return reshaped(draft, corners.with(action.corner, { ...corner, at: action.at }))
    }
    case 'insert': {
      const corner = corners[action.edge]
      if (!corner) return accept(draft)
      if (corners.length >= MAX_CORNERS) return reject('too-many-corners')
      return reshaped(draft, corners.toSpliced(action.edge + 1, 0, { at: action.at, edge: corner.edge }))
    }
    case 'settle':
      return closed(draft, corners)
    case 'remove': {
      const removed = corners[action.corner]
      if (!removed) return accept(draft)
      if (corners.length <= 3) return reject('too-few-corners')
      const previous = (action.corner - 1 + corners.length) % corners.length
      const merged = corners[previous].edge.road ? corners[previous].edge : removed.edge
      const relinked = corners.with(previous, { ...corners[previous], edge: merged })
      return closed(draft, relinked.toSpliced(action.corner, 1))
    }
    case 'mark-road':
      return replaceEdge(draft, action.edge, (edge) => (edge.road ? edge : { road: true, widthM: null, estimated: false }))
    case 'unmark-road':
      return replaceEdge(draft, action.edge, (edge) => (edge.road ? NEIGHBOUR : edge))
    case 'set-road-width':
      if (!isRoadWidth(action.widthM)) return accept(draft)
      return replaceEdge(draft, action.edge, (edge) => (edge.road ? roadOf(action.widthM, false, edge.prescribedWidthM) : edge))
    case 'set-prescribed-width': {
      const { prescribedWidthM } = action
      if (prescribedWidthM !== undefined && !isRoadWidth(prescribedWidthM)) return accept(draft)
      return replaceEdge(draft, action.edge, (edge) => {
        if (!edge.road || (prescribedWidthM !== undefined && edge.widthM !== null && prescribedWidthM <= edge.widthM)) return edge
        return roadOf(edge.widthM, edge.estimated, prescribedWidthM)
      })
    }
    case 'estimate-road-width':
      if (!isRoadWidth(action.widthM)) return accept(draft)
      return replaceEdge(draft, action.edge, (edge) =>
        edge.road && edge.widthM === null ? roadOf(action.widthM, true, edge.prescribedWidthM) : edge,
      )
    case 'estimate-road': {
      const { widthM } = action
      if (widthM !== null && !isRoadWidth(widthM)) return accept(draft)
      return replaceEdge(draft, action.edge, (edge) => {
        const open = edge.road ? edge.estimated : !edge.touched
        if (!open) return edge
        return widthM === null ? SIDE : { road: true, widthM, estimated: true }
      })
    }
    default:
      return accept(draft)
  }
}

function fromPlot(plot: Plot, nearStationSource: NearStationSource, roadsEstimated: boolean): EditResult {
  const roads = new Map(plot.roads.map((r) => [r.edge, r]))
  const corners = plot.ring.map((at, i): Corner => {
    const road = roads.get(i)
    return { at, edge: road ? roadOf(road.widthM, roadsEstimated, road.prescribedWidthM) : NEIGHBOUR }
  })
  return closed({ ...plot, limits: plot.limits ?? {}, nearStationSource }, corners)
}

function estimateNearStation(draft: Draft, nearStation: boolean): Draft {
  if (draft.nearStationSource === 'user') return draft
  if (draft.nearStationSource === 'estimate' && draft.nearStation === nearStation) return draft
  return { ...draft, nearStation, nearStationSource: 'estimate' }
}

function setLimit(draft: Draft, field: PlotLimitField, value: number | undefined): Draft {
  if (value === undefined) return { ...draft, limits: Object.fromEntries(Object.entries(draft.limits).filter(([key]) => key !== field)) }
  return PlotLimitsSchema.shape[field].safeParse(value).success ? { ...draft, limits: { ...draft.limits, [field]: value } } : draft
}

export function editDraft(draft: Draft, action: DraftAction): EditResult {
  switch (action.type) {
    case 'set-limit':
      return accept(setLimit(draft, action.field, action.value))
    case 'set-building-type':
      return accept({ ...draft, buildingType: action.buildingType })
    case 'set-near-station':
      return accept({ ...draft, nearStation: action.nearStation, nearStationSource: 'user' })
    case 'estimate-near-station':
      return accept(estimateNearStation(draft, action.nearStation))
    case 'clear':
      return accept({ ...emptyDraft(draft.buildingType), limits: draft.limits })
    case 'load':
      return fromPlot(action.plot, 'user', false)
    case 'load-example':
      return fromPlot(action.example.plot, 'default', action.example.roadsEstimated)
    case 'import':
      return closed(draft, action.ring.map((at) => ({ at: roundLngLat(at), edge: SIDE })))
    default:
      return draft.status === 'drawing' ? editDrawing(draft, action) : editClosed(draft, action)
  }
}

export function toPlot(draft: Draft): Plot | null {
  if (draft.status !== 'closed') return null
  const roads: Road[] = []
  for (const [edge, { edge: e }] of draft.corners.entries()) {
    if (!e.road) continue
    if (e.widthM === null) return null
    roads.push({ edge, widthM: e.widthM, ...(e.prescribedWidthM !== undefined && { prescribedWidthM: e.prescribedWidthM }) })
  }
  const { buildingType, nearStation, limits } = draft
  const entered = Object.keys(limits).length > 0 ? { limits } : {}
  const parsed = PlotSchema.safeParse({ ring: draft.corners.map((c) => c.at), roads, buildingType, nearStation, ...entered })
  return parsed.success ? parsed.data : null
}
