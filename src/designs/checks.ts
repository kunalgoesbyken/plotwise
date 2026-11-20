import type { Vec2 } from '@/geo/projection'
import { dot, edgeLengths, segmentDistance, subtract, type FloorPlates, type Loop, type Polygon } from '@/geometry'
import type { Comparator, Cite } from '@/rules'
import {
  boundarySetback,
  buildingControlOpenSpace,
  compare,
  frontOpenSpaceDepth,
  inRange,
  isHighRiseOrExtraLarge,
  mainRoad,
  negate,
  permeableArea,
  ratioOpenSpace,
  roadSetback,
  satisfies,
  strictest,
  type Building,
  type OpenSpaceNeed,
  type Solution,
} from '@/solve'
import type { Programme } from './programme'

export type CheckId =
  | 'far'
  | 'far-bonus-measures'
  | 'high-rise-far'
  | 'open-space-ratio'
  | 'permeable'
  | 'open-space-minimum'
  | 'boundary-setback'
  | 'road-setback'
  | 'height-vs-road'
  | 'front-open-space'
  | 'use-size'
  | 'use-station'
  | 'use-road-width'
  | 'road-access-frontage'
  | 'road-access-network'
  | 'high-rise-access'
  | 'high-rise-road-network'
  | 'fire-lane'

export type ManualCheckId = Extract<CheckId, 'far-bonus-measures' | 'use-station' | 'road-access-network' | 'high-rise-road-network'>

export type Unit = 'sqm' | 'm' | 'ratio' | 'rooms'

export type Check =
  | {
      readonly id: CheckId
      readonly cites: readonly Cite[]
      readonly status: 'pass' | 'fail'
      readonly actual: number
      readonly cmp: Comparator
      readonly limit: number
      readonly unit: Unit
    }
  | { readonly id: ManualCheckId; readonly cites: readonly Cite[]; readonly status: 'manual' }

export type DesignFacts = {
  readonly solution: Solution
  readonly plates: FloorPlates
  readonly building: Building
  readonly programme: Programme
}

const TOLERANCE: Readonly<Record<Unit, number>> = { sqm: 1e-2, m: 1e-3, ratio: 1e-9, rooms: 0 }

function measured(id: CheckId, actual: number, cmp: Comparator, limit: number, unit: Unit, cites: readonly Cite[]): Check {
  const slack = cmp === 'gt' || cmp === 'gte' ? -TOLERANCE[unit] : TOLERANCE[unit]
  return { id, status: compare(actual, cmp, limit + slack) ? 'pass' : 'fail', actual, cmp, limit, unit, cites }
}

const manual = (id: ManualCheckId, cites: readonly Cite[]): Check => ({ id, status: 'manual', cites })

type Segment = readonly [Vec2, Vec2]

const segments = (loop: Loop): Segment[] => loop.map((p, i) => [p, loop[(i + 1) % loop.length]])
const outerSegments = (polygons: readonly Polygon[]) => polygons.flatMap((p) => segments(p.outer))

function siteEdge({ site }: Solution, i: number): Segment {
  return [site.ring[i], site.ring[(i + 1) % site.ring.length]]
}

type Box = { readonly minX: number; readonly maxX: number; readonly minY: number; readonly maxY: number }
type BoxedSegment = { readonly segment: Segment; readonly box: Box }

const boxOf = ([[ax, ay], [bx, by]]: Segment): Box => ({
  minX: Math.min(ax, bx),
  maxX: Math.max(ax, bx),
  minY: Math.min(ay, by),
  maxY: Math.max(ay, by),
})

const boxGap = (a: Box, b: Box) =>
  Math.hypot(Math.max(0, a.minX - b.maxX, b.minX - a.maxX), Math.max(0, a.minY - b.maxY, b.minY - a.maxY))

function clearance(outline: readonly BoxedSegment[], edge: Segment): number {
  const box = boxOf(edge)
  let nearest = Infinity
  for (const { segment, box: around } of outline) {
    if (boxGap(box, around) >= nearest) continue
    nearest = Math.min(nearest, segmentDistance(segment[0], segment[1], edge[0], edge[1]))
  }
  return nearest
}

type Level = { readonly topM: number; readonly clearanceM: readonly number[] }
type Context = DesignFacts & { readonly ground: Level; readonly levels: readonly Level[] }

function levelsOf({ solution, plates }: DesignFacts): Level[] {
  const tops = new Map<readonly Polygon[], number>([[plates.footprint, 0]])
  for (const floor of plates.floors) tops.set(floor.polygons, Math.max(tops.get(floor.polygons) ?? 0, floor.topM))
  const edges = solution.site.edges.map((_, i) => siteEdge(solution, i))
  return [...tops].map(([polygons, topM]) => {
    const outline = outerSegments(polygons).map((segment) => ({ segment, box: boxOf(segment) }))
    return { topM, clearanceM: edges.map((edge) => clearance(outline, edge)) }
  })
}

function openSpaceNeed({ solution, plates, programme, building }: DesignFacts): OpenSpaceNeed {
  return {
    landSqm: solution.site.areaSqm,
    farSqm: programme.farSqm,
    largestFloorSqm: Math.max(0, ...plates.floors.map((f) => f.areaSqm)),
    highRiseOrExtraLarge: isHighRiseOrExtraLarge(solution.pack, building),
  }
}

function openSpaceChecks(facts: DesignFacts): Check[] {
  const { limits, site, farCap } = facts.solution
  const need = openSpaceNeed(facts)
  const openSqm = site.areaSqm - facts.plates.footprintSqm
  const ratio = ratioOpenSpace(limits, need.farSqm)
  const permeable = permeableArea(limits, need, openSqm)
  const minimum = buildingControlOpenSpace(limits, need)
  return [
    measured('far', need.farSqm, 'lte', farCap.maxGfaSqm, 'sqm', farCap.cites),
    measured('open-space-ratio', openSqm, 'gte', ratio.value, 'sqm', ratio.cites),
    measured('permeable', openSqm, 'gte', permeable.value, 'sqm', permeable.cites),
    measured('open-space-minimum', openSqm, 'gte', minimum.value, 'sqm', minimum.cites),
  ]
}

function setbackChecks({ solution, building, levels }: Context): Check[] {
  const { pack, site } = solution
  const nearest = (edge: number) => Math.min(...levels.map((level) => level.clearanceM[edge]))
  const edges = site.edges.map((edge, i) => ({ ...edge, i }))
  const boundaries = edges.filter((e) => e.roadWidthM === null)
  const roads = edges.flatMap((e) => (e.roadWidthM === null ? [] : [{ ...e, roadWidthM: e.roadWidthM }]))
  const checks: Check[] = []
  if (boundaries.length > 0) {
    const required = boundarySetback(pack, building, 'boundary')
    checks.push(measured('boundary-setback', Math.min(...boundaries.map((e) => nearest(e.i))), 'gte', required.distanceM, 'm', required.cites))
  }
  const roadMargins = roads.map((e) => {
    const required = strictest([roadSetback(pack, building, e.roadWidthM), boundarySetback(pack, building, 'road')])
    const actual = nearest(e.i)
    return { actual, required, margin: actual - required.distanceM }
  })
  const worstRoad = roadMargins.reduce((worst, r) => (r.margin < worst.margin ? r : worst))
  checks.push(measured('road-setback', worstRoad.actual, 'gte', worstRoad.required.distanceM, 'm', worstRoad.required.cites))
  const multiple = solution.limits.height.vsRoadMultiple
  const heights = roads.flatMap((e) =>
    levels.map((level) => {
      const allowed = multiple.value * (e.roadWidthM + level.clearanceM[e.i])
      return { actual: level.topM, allowed, margin: allowed - level.topM }
    }),
  )
  const worstHeight = heights.reduce((worst, h) => (h.margin < worst.margin ? h : worst))
  checks.push(measured('height-vs-road', worstHeight.actual, 'lte', worstHeight.allowed, 'm', multiple.cites))
  return checks
}

function outwardNormal([p, q]: Segment): Vec2 {
  return [q[1] - p[1], p[0] - q[0]]
}

function roadFacingShare({ solution, plates }: DesignFacts): number {
  const { site, pack } = solution
  const roads = site.edges.flatMap((e, i) => (e.roadWidthM === null ? [] : [siteEdge(solution, i)]))
  const outline = outerSegments(plates.footprint)
  const facesRoad = (segment: Segment) =>
    roads.some(
      (road) =>
        satisfies(segmentDistance(segment[0], segment[1], road[0], road[1]), pack.frontOpenSpace.exemptIfWithinRoadM) &&
        dot(outwardNormal(segment), outwardNormal(road)) > 0,
    )
  const perimeter = plates.footprint.flatMap((p) => edgeLengths(p.outer)).reduce((sum, m) => sum + m, 0)
  const facing = outline.filter(facesRoad).reduce((sum, [p, q]) => sum + Math.hypot(...subtract(q, p)), 0)
  return perimeter > 0 ? facing / perimeter : 0
}

function frontOpenSpaceCheck(facts: Context): Check {
  const { solution, building, ground } = facts
  const { pack, readings } = solution
  const depth = frontOpenSpaceDepth(pack, building.storeys)
  const front = ground.clearanceM[mainRoad(solution.site)]
  const required = measured('front-open-space', front, 'gte', depth.distanceM, 'm', [pack.frontOpenSpace.appliesTo, ...depth.cites])
  if (readings['front-open-space'] === 'always') return required
  const exemption = pack.frontOpenSpace.exemptIfFrontageShareOfPerimeter
  const share = roadFacingShare(facts)
  if (!satisfies(share, exemption)) return required
  return measured('front-open-space', share, exemption.cmp, exemption.value, 'ratio', [exemption.cite, pack.frontOpenSpace.exemptIfWithinRoadM.cite])
}

function conditionChecks({ solution, programme }: DesignFacts): Check[] {
  const { use } = solution.limits
  if (use.kind === 'permitted') return []
  const allowed = negate(use.threshold.cmp)
  const unit: Unit = use.measure === 'rooms' ? 'rooms' : 'sqm'
  const size = measured('use-size', programme.conditionMeasure, allowed, use.threshold.value, unit, use.cites)
  if (size.status === 'pass') return [size]
  const { exemption } = use
  switch (exemption.kind) {
    case 'none':
      return [size]
    case 'station':
      return [manual('use-station', exemption.cites)]
    case 'road': {
      const edge = solution.site.edges[exemption.edge]
      const width = measured('use-road-width', edge.roadWidthM ?? 0, use.roadWidthM.cmp, use.roadWidthM.value, 'm', exemption.cites)
      const tier = exemption.tier
      if (!tier) return [width]
      return [
        width,
        measured('road-access-frontage', edge.lengthM, tier.frontageM.cmp, tier.frontageM.value, 'm', [tier.frontageM.cite]),
        manual('road-access-network', [tier.otherEndRoadWidthM.cite, tier.maxDistanceM.cite]),
      ]
    }
  }
}

function highRiseChecks({ solution, building, programme, ground }: Context): Check[] {
  const { limits, site, pack } = solution
  if (!isHighRiseOrExtraLarge(pack, building)) return []
  const { access } = pack.highRise
  const band = access.find((b) => inRange(building.floorAreaSqm, b.floorAreaSqm)) ?? access[access.length - 1]
  const frontage = Math.max(0, ...site.edges.map((e) => (e.roadWidthM !== null && satisfies(e.roadWidthM, band.roadWidthM) ? e.lengthM : 0)))
  const fireLane = Math.min(...ground.clearanceM)
  return [
    measured('high-rise-far', programme.farSqm / site.areaSqm, 'lte', limits.highRise.farMax.value, 'ratio', limits.highRise.farMax.cites),
    measured('high-rise-access', frontage, band.frontageM.cmp, band.frontageM.value, 'm', [band.frontageM.cite, band.roadWidthM.cite]),
    manual('high-rise-road-network', [band.roadWidthM.cite, pack.highRise.accessStripWidthM.cite]),
    measured('fire-lane', fireLane, limits.highRise.fireLaneWidthM.cmp, limits.highRise.fireLaneWidthM.value, 'm', [limits.highRise.fireLaneWidthM.cite]),
  ]
}

function farBonusChecks({ solution }: DesignFacts): Check[] {
  if (solution.farCap.mode === 'standard') return []
  const cites = solution.limits.farBonus.measures.filter((m) => m.eligible).flatMap((m) => m.cites)
  return [manual('far-bonus-measures', cites)]
}

export function checksFor(facts: DesignFacts): Check[] {
  const [ground, ...upper] = levelsOf(facts)
  const context = { ...facts, ground, levels: [ground, ...upper] }
  return [
    ...openSpaceChecks(context),
    ...farBonusChecks(context),
    ...setbackChecks(context),
    frontOpenSpaceCheck(context),
    ...conditionChecks(context),
    ...highRiseChecks(context),
  ]
}
