import type { LngLat } from '@/geo/projection'
import { PlotSchema, type BuildingType, type Plot, type Road } from '@/plot/plot'
import { checkOutline, normalizeOutline, SIDE, type Corner, type Edge, type OutlineRejection } from './outline'
import { isSimplePath } from './path'

export const MAX_CORNERS = 100

const COORDINATE_SCALE = 1e7

export type Draft =
  | { status: 'drawing'; points: readonly LngLat[]; buildingType: BuildingType }
  | { status: 'closed'; corners: readonly Corner[]; buildingType: BuildingType }

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
  | { type: 'set-building-type'; buildingType: BuildingType }
  | { type: 'clear' }
  | { type: 'load'; plot: Plot }

export type Rejection = OutlineRejection | 'too-few-corners' | 'too-many-corners'
export type EditResult = { ok: true; draft: Draft } | { ok: false; reason: Rejection }

type ClosedDraft = Extract<Draft, { status: 'closed' }>
type DrawingDraft = Extract<Draft, { status: 'drawing' }>

export function emptyDraft(buildingType: BuildingType): Draft {
  return { status: 'drawing', points: [], buildingType }
}

function roundCoordinate(value: number) {
  return Math.round(value * COORDINATE_SCALE) / COORDINATE_SCALE || 0
}

export function roundLngLat([lng, lat]: LngLat): [number, number] {
  return [roundCoordinate(lng), roundCoordinate(lat)]
}

const accept = (draft: Draft): EditResult => ({ ok: true, draft })
const reject = (reason: Rejection): EditResult => ({ ok: false, reason })

function closed(buildingType: BuildingType, corners: readonly Corner[]): EditResult {
  if (corners.length < 3) return reject('too-few-corners')
  if (corners.length > MAX_CORNERS) return reject('too-many-corners')
  const outline = normalizeOutline(corners)
  return outline.ok ? accept({ status: 'closed', corners: outline.corners, buildingType }) : reject(outline.reason)
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
      const next = [...points, action.at]
      return isSimplePath(next) ? accept({ ...draft, points: next }) : reject('crossing')
    }
    case 'undo':
      return accept({ ...draft, points: points.slice(0, -1) })
    case 'close':
      return closed(
        draft.buildingType,
        points.map((at) => ({ at, edge: SIDE })),
      )
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
      return closed(draft.buildingType, corners)
    case 'remove': {
      const removed = corners[action.corner]
      if (!removed) return accept(draft)
      if (corners.length <= 3) return reject('too-few-corners')
      const previous = (action.corner - 1 + corners.length) % corners.length
      const merged = corners[previous].edge.road ? corners[previous].edge : removed.edge
      const relinked = corners.with(previous, { ...corners[previous], edge: merged })
      return closed(draft.buildingType, relinked.toSpliced(action.corner, 1))
    }
    case 'mark-road':
      return replaceEdge(draft, action.edge, (edge) => (edge.road ? edge : { road: true, widthM: null, estimated: false }))
    case 'unmark-road':
      return replaceEdge(draft, action.edge, (edge) => (edge.road ? SIDE : edge))
    case 'set-road-width':
      return replaceEdge(draft, action.edge, (edge) =>
        edge.road ? { road: true, widthM: action.widthM, estimated: false } : edge,
      )
    case 'estimate-road-width':
      return replaceEdge(draft, action.edge, (edge) =>
        edge.road && edge.widthM === null ? { road: true, widthM: action.widthM, estimated: true } : edge,
      )
    default:
      return accept(draft)
  }
}

function fromPlot(plot: Plot): EditResult {
  const widths = new Map(plot.roads.map((r) => [r.edge, r.widthM]))
  const corners = plot.ring.map((at, i): Corner => {
    const widthM = widths.get(i)
    return { at, edge: widthM === undefined ? SIDE : { road: true, widthM, estimated: false } }
  })
  return closed(plot.buildingType, corners)
}

export function editDraft(draft: Draft, action: DraftAction): EditResult {
  switch (action.type) {
    case 'set-building-type':
      return accept({ ...draft, buildingType: action.buildingType })
    case 'clear':
      return accept(emptyDraft(draft.buildingType))
    case 'load':
      return fromPlot(action.plot)
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
  const parsed = PlotSchema.safeParse({ ring: draft.corners.map((c) => c.at), roads, buildingType: draft.buildingType })
  return parsed.success ? parsed.data : null
}
