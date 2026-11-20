import { edgeLengths, offsetEdges, polygonArea, type Ring } from '@/geometry'
import type { Site, SiteEdge } from '@/plot/site'
import type { Cite, Reservation } from '@/rules'
import { ASSUMPTIONS } from './assumptions'

export type Widening = {
  readonly grossRing: Ring
  readonly grossAreaSqm: number
  readonly reservedSqm: number
  readonly depthsM: readonly number[]
  readonly farOn: Reservation['farOn']
  readonly inLieuGfaSqm: number
  readonly inLieuCites: readonly Cite[]
  readonly cites: readonly Cite[]
}

export type Reserved = { readonly site: Site; readonly widening: Widening | null }

type Strip = { readonly depthM: number; readonly roadWidthM: number | null; readonly by: Reservation | null }

function widenedWidth({ target }: Reservation, edge: SiteEdge): number | null {
  return target.kind === 'width' ? target.widthM.value : edge.prescribedWidthM
}

function stripOf(edge: SiteEdge, reservations: readonly Reservation[]): Strip {
  const { roadWidthM } = edge
  const none: Strip = { depthM: 0, roadWidthM, by: null }
  if (roadWidthM === null) return none
  return reservations.reduce<Strip>((widest, reservation) => {
    const widthM = widenedWidth(reservation, edge)
    if (widthM === null || widthM <= (widest.roadWidthM ?? roadWidthM)) return widest
    return { depthM: (widthM - roadWidthM) * ASSUMPTIONS.wideningShareOnPlotSide.value, roadWidthM: widthM, by: reservation }
  }, none)
}

const targetCite = ({ target }: Reservation): Cite => (target.kind === 'width' ? target.widthM.cite : target.cite)

function inLieu(governing: Reservation, reservedSqm: number): Pick<Widening, 'inLieuGfaSqm' | 'inLieuCites'> {
  if (!governing.inLieu) return { inLieuGfaSqm: 0, inLieuCites: [] }
  const { multipleOfReserved, notes } = governing.inLieu
  return { inLieuGfaSqm: multipleOfReserved.value * reservedSqm, inLieuCites: [multipleOfReserved.cite, ...notes] }
}

export function reserveRoadWidening(site: Site, reservations: readonly Reservation[]): Reserved {
  const strips = site.edges.map((edge) => stripOf(edge, reservations))
  const biting = [...new Set(strips.flatMap(({ by }) => (by ? [by] : [])))]
  const governing = strips.reduce((deepest, strip) => (strip.depthM > deepest.depthM ? strip : deepest)).by
  if (!governing) return { site, widening: null }
  const ring = offsetEdges(site.ring, strips.map(({ depthM }) => depthM))
  const areaSqm = polygonArea({ outer: ring, holes: [] })
  const reservedSqm = site.areaSqm - areaSqm
  return {
    site: {
      ...site,
      ring,
      areaSqm,
      edges: edgeLengths(ring).map((lengthM, i) => ({ lengthM, roadWidthM: strips[i].roadWidthM, prescribedWidthM: null })),
    },
    widening: {
      grossRing: site.ring,
      grossAreaSqm: site.areaSqm,
      reservedSqm,
      depthsM: strips.map(({ depthM }) => depthM),
      farOn: governing.farOn,
      ...inLieu(governing, reservedSqm),
      cites: biting.flatMap((r) => [targetCite(r), ...r.notes]),
    },
  }
}
