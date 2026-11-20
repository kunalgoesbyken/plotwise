import { localFrame, type LngLat } from '@/geo/projection'
import { GeometryError, normalizeRing, type GeometryErrorReason } from '@/geometry'
import { LngLatSchema } from '@/plot/plot'

export type Edge = { road: false; touched: boolean } | { road: true; widthM: number | null; estimated: boolean }
export type Corner = { at: LngLat; edge: Edge }

export type OutlineRejection = 'crossing' | 'degenerate' | 'out-of-range'
export type OutlineResult = { ok: true; corners: Corner[] } | { ok: false; reason: OutlineRejection }

export const SIDE: Edge = { road: false, touched: false }
export const NEIGHBOUR: Edge = { road: false, touched: true }

export const isOnEarth = (at: LngLat) => LngLatSchema.safeParse(at).success

const REJECTION_FOR: Partial<Record<GeometryErrorReason, OutlineRejection>> = {
  'self-intersecting': 'crossing',
  degenerate: 'degenerate',
  'non-finite': 'out-of-range',
  'out-of-range': 'out-of-range',
}

function normalizedOrder(corners: readonly Corner[]): number[] | OutlineRejection {
  if (!corners.every((c) => isOnEarth(c.at))) return 'out-of-range'
  const frame = localFrame(corners[0].at)
  const local = corners.map((c) => frame.toLocal(c.at))
  try {
    return normalizeRing(local).map(([x, y]) => local.findIndex(([lx, ly]) => lx === x && ly === y))
  } catch (error) {
    const reason = error instanceof GeometryError ? REJECTION_FOR[error.reason] : undefined
    if (!reason) throw error
    return reason
  }
}

function isForward(order: readonly number[], count: number) {
  const steps = order.reduce((sum, k, j) => sum + ((order[(j + 1) % order.length] - k + count) % count), 0)
  return steps === count
}

function edgeOverSpan(corners: readonly Corner[], from: number, to: number): Edge {
  for (let i = from; i !== to; i = (i + 1) % corners.length) {
    if (corners[i].edge.road) return corners[i].edge
  }
  return corners[from].edge
}

export function checkOutline(corners: readonly Corner[]): OutlineRejection | null {
  const order = normalizedOrder(corners)
  return typeof order === 'string' ? order : null
}

export function normalizeOutline(corners: readonly Corner[]): OutlineResult {
  const order = normalizedOrder(corners)
  if (typeof order === 'string') return { ok: false, reason: order }
  const forward = isForward(order, corners.length)
  const normalized = order.map((k, j): Corner => {
    const next = order[(j + 1) % order.length]
    const edge = forward ? edgeOverSpan(corners, k, next) : edgeOverSpan(corners, next, k)
    return { at: corners[k].at, edge }
  })
  return { ok: true, corners: normalized }
}
