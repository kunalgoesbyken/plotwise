import { localFrame, type LocalFrame, type Vec2 } from '@/geo/projection'
import { edgeLengths, normalizeRing, polygonArea, signedArea, type Ring } from '@/geometry'
import type { Plot } from './plot'

export type SiteEdge = { readonly lengthM: number; readonly roadWidthM: number | null }

export type Site = {
  readonly frame: LocalFrame
  readonly ring: Ring
  readonly areaSqm: number
  readonly edges: readonly SiteEdge[]
}

function roadOverSpan(widths: ReadonlyMap<number, number>, from: number, to: number, count: number): number | null {
  for (let i = from; i !== to; i = (i + 1) % count) {
    const widthM = widths.get(i)
    if (widthM !== undefined) return widthM
  }
  return null
}

function roadWidths(plot: Plot, local: readonly Vec2[], ring: Ring): (number | null)[] {
  const widths = new Map(plot.roads.map((r) => [r.edge, r.widthM]))
  const forward = signedArea(local) > 0
  const order = ring.map((point) => local.indexOf(point))
  return order.map((k, j) => {
    const next = order[(j + 1) % order.length]
    return forward ? roadOverSpan(widths, k, next, local.length) : roadOverSpan(widths, next, k, local.length)
  })
}

export function siteOf(plot: Plot): Site {
  const frame = localFrame(plot.ring[0])
  const local = plot.ring.map(frame.toLocal)
  const ring = normalizeRing(local)
  const widths = roadWidths(plot, local, ring)
  return {
    frame,
    ring,
    areaSqm: polygonArea({ outer: ring, holes: [] }),
    edges: edgeLengths(ring).map((lengthM, i) => ({ lengthM, roadWidthM: widths[i] })),
  }
}
