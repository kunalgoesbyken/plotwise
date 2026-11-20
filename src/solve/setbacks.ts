import type { Cite, Cited, FrontOpenSpace, RoadSetbackDistance, RoadSetbackRule, RulePack } from '@/rules'
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

const appliesTo = ({ storeys, heightM }: RoadSetbackRule['appliesAbove'], building: Building) =>
  (storeys !== undefined && satisfies(building.storeys, storeys)) || (heightM !== undefined && satisfies(building.heightM, heightM))

export function roadSetback(pack: RulePack, building: Building, roadWidthM: number): Setback {
  const applicable = pack.roadSetbacks.filter(({ appliesAbove }) => appliesTo(appliesAbove, building))
  return strictest(
    applicable.flatMap((rule) =>
      rule.bands.filter((band) => inRange(roadWidthM, band.roadWidthM)).map((band) => roadDistance(band.setback, roadWidthM)),
    ),
  )
}

export function heightVsRoadMultiple(pack: RulePack): { readonly value: number; readonly cites: readonly Cite[] } | null {
  const multiples = pack.height.roadMultiple?.maxMultipleOfDistance
  if (!multiples) return null
  const value = Math.min(...multiples.map((m) => m.value))
  return { value, cites: multiples.filter((m) => m.value === value).map((m) => m.cite) }
}

export function heightVsRoadSetback(pack: RulePack, roadWidthM: number, heightM: number): Setback {
  const multiple = heightVsRoadMultiple(pack)
  if (!multiple) return NO_SETBACK
  const distanceM = heightM / multiple.value - roadWidthM
  return distanceM > 0 ? { distanceM, cites: multiple.cites } : NO_SETBACK
}

export function frontOpenSpaceDepth({ depthM, tallAboveStoreys, tallDepthM }: FrontOpenSpace, storeys: number): Setback {
  return fromCited(satisfies(storeys, tallAboveStoreys) ? tallDepthM : depthM)
}
