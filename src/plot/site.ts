import { localFrame, type LocalFrame, type Vec2 } from '@/geo/projection'
import { edgeLengths, normalizeRing, polygonArea, signedArea, type Ring } from '@/geometry'
import type { Plot, Road } from './plot'

export type SiteEdge = { readonly lengthM: number; readonly roadWidthM: number | null; readonly prescribedWidthM: number | null }

export type Site = {
  readonly frame: LocalFrame
  readonly ring: Ring
  readonly areaSqm: number
  readonly edges: readonly SiteEdge[]
}

function roadOverSpan(roads: ReadonlyMap<number, Road>, from: number, to: number, count: number): Road | null {
  for (let i = from; i !== to; i = (i + 1) % count) {
    const road = roads.get(i)
    if (road) return road
  }
  return null
}

function roadsByEdge(plot: Plot, local: readonly Vec2[], ring: Ring): (Road | null)[] {
  const roads = new Map(plot.roads.map((r) => [r.edge, r]))
  const forward = signedArea(local) > 0
  const order = ring.map((point) => local.indexOf(point))
  return order.map((k, j) => {
    const next = order[(j + 1) % order.length]
    return forward ? roadOverSpan(roads, k, next, local.length) : roadOverSpan(roads, next, k, local.length)
  })
}

export function siteOf(plot: Plot): Site {
  const frame = localFrame(plot.ring[0])
  const local = plot.ring.map(frame.toLocal)
  const ring = normalizeRing(local)
  const roads = roadsByEdge(plot, local, ring)
  return {
    frame,
    ring,
    areaSqm: polygonArea({ outer: ring, holes: [] }),
    edges: edgeLengths(ring).map((lengthM, i) => ({
      lengthM,
      roadWidthM: roads[i]?.widthM ?? null,
      prescribedWidthM: roads[i]?.prescribedWidthM ?? null,
    })),
  }
}

export function mainRoad({ edges }: Site): number {
  return edges.reduce((best, edge, i) => {
    const current = edges[best]
    if (edge.roadWidthM === null) return best
    if (current.roadWidthM === null || edge.roadWidthM > current.roadWidthM) return i
    return edge.roadWidthM === current.roadWidthM && edge.lengthM > current.lengthM ? i : best
  }, 0)
}
