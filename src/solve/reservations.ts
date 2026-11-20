import { edgeLengths, offsetEdges, polygonArea } from '@/geometry'
import type { Site, SiteEdge } from '@/plot/site'
import type { Cite, Reservation } from '@/rules'

export type Widening = {
  readonly grossAreaSqm: number
  readonly reservedSqm: number
  readonly depthsM: readonly number[]
  readonly farOn: Reservation['farOn']
  readonly cites: readonly Cite[]
}

export type Reserved = { readonly site: Site; readonly widening: Widening | null }

type Strip = { readonly depthM: number; readonly roadWidthM: number | null }

function stripOf({ roadWidthM }: SiteEdge, reservations: readonly Reservation[]): Strip {
  if (roadWidthM === null) return { depthM: 0, roadWidthM }
  const widenedM = Math.max(roadWidthM, ...reservations.map((r) => r.targetWidthM.value))
  return { depthM: (widenedM - roadWidthM) / 2, roadWidthM: widenedM }
}

export function reserveRoadWidening(site: Site, reservations: readonly Reservation[]): Reserved {
  const strips = site.edges.map((edge) => stripOf(edge, reservations))
  if (strips.every(({ depthM }) => depthM === 0)) return { site, widening: null }
  const ring = offsetEdges(site.ring, strips.map(({ depthM }) => depthM))
  const areaSqm = polygonArea({ outer: ring, holes: [] })
  const bites = (r: Reservation) => site.edges.some((edge) => edge.roadWidthM !== null && edge.roadWidthM < r.targetWidthM.value)
  const biting = reservations.filter(bites)
  const governing = biting.reduce((widest, r) => (r.targetWidthM.value > widest.targetWidthM.value ? r : widest))
  return {
    site: { ...site, ring, areaSqm, edges: edgeLengths(ring).map((lengthM, i) => ({ lengthM, roadWidthM: strips[i].roadWidthM })) },
    widening: {
      grossAreaSqm: site.areaSqm,
      reservedSqm: site.areaSqm - areaSqm,
      depthsM: strips.map(({ depthM }) => depthM),
      farOn: governing.farOn,
      cites: biting.flatMap((r) => [r.targetWidthM.cite, ...r.notes]),
    },
  }
}
