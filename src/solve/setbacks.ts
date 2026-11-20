import type { SiteEdge } from '@/plot/site'
import type { Cite, Cited, FrontOpenSpace, RoadMultiple, RoadSetbackDistance, RoadSetbackRule, RulePack } from '@/rules'
import { inRange, satisfies } from './bound'
import { isHighRiseOrExtraLarge, type Building } from './building'

export type Setback = { readonly distanceM: number; readonly cites: readonly Cite[] }
export type EdgeKind = 'road' | 'boundary'

export const NO_SETBACK: Setback = { distanceM: 0, cites: [] }

export function strictest(setbacks: readonly Setback[]): Setback {
  const distanceM = Math.max(0, ...setbacks.map((s) => s.distanceM))
  if (distanceM === 0) return NO_SETBACK
  return { distanceM, cites: setbacks.filter((s) => s.distanceM === distanceM).flatMap((s) => s.cites) }
}

const fromCited = ({ value, cite }: Cited): Setback => ({ distanceM: value, cites: [cite] })

export function boundarySetback(pack: RulePack, building: Building, edge: EdgeKind): Setback {
  const highRise = isHighRiseOrExtraLarge(pack, building)
  const applicable = pack.boundarySetbacks.filter(
    (rule) => (rule.scope === 'anyBuilding' || highRise) && (edge === 'boundary' || rule.from === 'plotBoundaryOrPublicRoad'),
  )
  return strictest(
    applicable.flatMap((rule) => rule.bands.filter((band) => inRange(building.heightM, band.heightM)).map((band) => fromCited(band.distanceM))),
  )
}

function roadDistance(setback: RoadSetbackDistance, roadWidthM: number): Setback {
  switch (setback.kind) {
    case 'fromCentreline':
      return { distanceM: Math.max(0, setback.distanceM.value - roadWidthM / 2), cites: [setback.distanceM.cite] }
    case 'fromRoadBoundary':
      return fromCited(setback.distanceM)
    case 'fromRoadBoundaryShareOfWidth':
      return { distanceM: setback.share.value * roadWidthM, cites: [setback.share.cite] }
  }
}

const appliesTo = (above: RoadSetbackRule['appliesAbove'], building: Building) =>
  !above ||
  (above.storeys !== undefined && satisfies(building.storeys, above.storeys)) ||
  (above.heightM !== undefined && satisfies(building.heightM, above.heightM))

export function roadSetback(pack: RulePack, building: Building, roadWidthM: number): Setback {
  const applicable = pack.roadSetbacks.filter(({ appliesAbove }) => appliesTo(appliesAbove, building))
  return strictest(
    applicable.flatMap((rule) =>
      rule.bands.filter((band) => inRange(roadWidthM, band.roadWidthM)).map((band) => roadDistance(band.setback, roadWidthM)),
    ),
  )
}

export type HeightVsRoad = { readonly value: number; readonly distance: RoadMultiple['distance']; readonly cites: readonly Cite[] }

export function heightVsRoadMultiple(pack: RulePack): HeightVsRoad | null {
  const rule = pack.height.roadMultiple
  if (!rule) return null
  const value = Math.min(...rule.maxMultipleOfDistance.map((m) => m.value))
  const cites = rule.maxMultipleOfDistance.filter((m) => m.value === value).map((m) => m.cite)
  return { value, distance: rule.distance, cites: [...cites, ...(rule.widestStreetGoverns ? [rule.widestStreetGoverns] : [])] }
}

const OPEN_GROUND: Building = { heightM: 0, storeys: 0, floorAreaSqm: 0 }

export function streetHeightLimitM(pack: RulePack, edges: readonly SiteEdge[], multiple: number): number {
  const widestM = Math.max(...edges.flatMap((edge) => (edge.roadWidthM === null ? [] : [edge.roadWidthM])))
  return multiple * (widestM + roadSetback(pack, OPEN_GROUND, widestM).distanceM)
}

export function heightVsRoadSetback(pack: RulePack, roadWidthM: number, heightM: number): Setback {
  const multiple = heightVsRoadMultiple(pack)
  if (!multiple || multiple.distance !== 'toBuilding') return NO_SETBACK
  const distanceM = heightM / multiple.value - roadWidthM
  return distanceM > 0 ? { distanceM, cites: multiple.cites } : NO_SETBACK
}

export function frontOpenSpaceDepth({ depthM, tallAboveStoreys, tallDepthM }: FrontOpenSpace, storeys: number): Setback {
  return fromCited(satisfies(storeys, tallAboveStoreys) ? tallDepthM : depthM)
}
