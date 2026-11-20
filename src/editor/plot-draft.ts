import type { LngLat } from '@/geo/projection'
import { MAX_CORNERS, PlotSchema, RoadWidthSchema, type BuildingType, type Plot, type Road } from '@/plot/plot'
import { checkOutline, isOnEarth, NEIGHBOUR, normalizeOutline, SIDE, type Corner, type Edge, type OutlineRejection } from './outline'
import { isSimplePath } from './path'

const COORDINATE_SCALE = 1e7

export type NearStationSource = 'default' | 'estimate' | 'user'

type Brief = { buildingType: BuildingType; nearStation: boolean; nearStationSource: NearStationSource }

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
  | { type: 'estimate-road-width'; edge: number; widthM: number }
  | { type: 'estimate-road'; edge: number; widthM: number | null }
  | { type: 'set-building-type'; buildingType: BuildingType }
  | { type: 'set-near-station'; nearStation: boolean }
  | { type: 'estimate-near-station'; nearStation: boolean }
  | { type: 'clear' }
  | { type: 'load'; plot: Plot }
  | { type: 'load-example'; plot: Plot }
  | { type: 'import'; ring: readonly LngLat[] }

export type Rejection = OutlineRejection | 'too-few-corners' | 'too-many-corners'
export type EditResult = { ok: true; draft: Draft } | { ok: false; reason: Rejection }

type ClosedDraft = Extract<Draft, { status: 'closed' }>
type DrawingDraft = Extract<Draft, { status: 'drawing' }>

export function emptyDraft(buildingType: BuildingType): Draft {
  return { status: 'drawing', points: [], buildingType, nearStation: false, nearStationSource: 'default' }
}

function roundCoordinate(value: number) {
  return Math.round(value * COORDINATE_SCALE) / COORDINATE_SCALE || 0
}

export function roundLngLat([lng, lat]: LngLat): [number, number] {
  return [roundCoordinate(lng), roundCoordinate(lat)]
}

const isRoadWidth = (widthM: number) => RoadWidthSchema.safeParse(widthM).success

const accept = (draft: Draft): EditResult => ({ ok: true, draft })
const reject = (reason: Rejection): EditResult => ({ ok: false, reason })

function closed(brief: Brief, corners: readonly Corner[]): EditResult {
  if (corners.length < 3) return reject('too-few-corners')
  if (corners.length > MAX_CORNERS) return reject('too-many-corners')
  const outline = normalizeOutline(corners)
  const { buildingType, nearStation, nearStationSource } = brief
  if (!outline.ok) return reject(outline.reason)
  return accept({ status: 'closed', corners: outline.corners, buildingType, nearStation, nearStationSource })
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
      return replaceEdge(draft, action.edge, (edge) =>
        edge.road ? { road: true, widthM: action.widthM, estimated: false } : edge,
      )
    case 'estimate-road-width':
      if (!isRoadWidth(action.widthM)) return accept(draft)
      return replaceEdge(draft, action.edge, (edge) =>
        edge.road && edge.widthM === null ? { road: true, widthM: action.widthM, estimated: true } : edge,
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

function fromPlot(plot: Plot, nearStationSource: NearStationSource): EditResult {
  const widths = new Map(plot.roads.map((r) => [r.edge, r.widthM]))
  const corners = plot.ring.map((at, i): Corner => {
    const widthM = widths.get(i)
    return { at, edge: widthM === undefined ? NEIGHBOUR : { road: true, widthM, estimated: false } }
  })
  return closed({ ...plot, nearStationSource }, corners)
}

function estimateNearStation(draft: Draft, nearStation: boolean): Draft {
  if (draft.nearStationSource === 'user') return draft
  if (draft.nearStationSource === 'estimate' && draft.nearStation === nearStation) return draft
  return { ...draft, nearStation, nearStationSource: 'estimate' }
}

export function editDraft(draft: Draft, action: DraftAction): EditResult {
  switch (action.type) {
    case 'set-building-type':
      return accept({ ...draft, buildingType: action.buildingType })
    case 'set-near-station':
      return accept({ ...draft, nearStation: action.nearStation, nearStationSource: 'user' })
    case 'estimate-near-station':
      return accept(estimateNearStation(draft, action.nearStation))
    case 'clear':
      return accept(emptyDraft(draft.buildingType))
    case 'load':
      return fromPlot(action.plot, 'user')
    case 'load-example':
      return fromPlot(action.plot, 'default')
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
    roads.push({ edge, widthM: e.widthM })
  }
  const { buildingType, nearStation } = draft
  const parsed = PlotSchema.safeParse({ ring: draft.corners.map((c) => c.at), roads, buildingType, nearStation })
  return parsed.success ? parsed.data : null
}
