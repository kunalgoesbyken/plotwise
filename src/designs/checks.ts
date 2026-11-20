import type { Vec2 } from '@/geo/projection'
import type { PlotLimitField } from '@/plot/plot'
import { mainRoad } from '@/plot/site'
import { dot, edgeLengths, segmentDistance, subtract, type FloorPlates, type Loop, type Polygon } from '@/geometry'
import type { Cite, Comparator, FrontOpenSpace } from '@/rules'
import {
  boundarySetback,
  buildingControlOpenSpace,
  compare,
  frontOpenSpaceDepth,
  inRange,
  isHighRiseOrExtraLarge,
  isUnentered,
  lowRiseSetbacks,
  rearEdge,
  negate,
  permeableArea,
  ratioOpenSpace,
  roadSetback,
  satisfies,
  sideRearOpenSpace,
  streetHeightLimitM,
  strictest,
  type Building,
  type OpenSpaceNeed,
  type Solution,
} from '@/solve'
import type { Programme } from './programme'

export type CheckId =
  | 'far'
  | 'far-bonus-measures'
  | 'far-purchase'
  | 'coverage'
  | 'height-cap'
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

export type ManualCheckId = Extract<CheckId, 'far-bonus-measures' | 'far-purchase' | 'use-station' | 'road-access-network' | 'high-rise-road-network'>

export type EnteredCheckId = Extract<CheckId, 'boundary-setback' | 'road-setback' | 'open-space-minimum'>

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
  | { readonly id: EnteredCheckId; readonly cites: readonly Cite[]; readonly status: 'manual'; readonly unentered: PlotLimitField }

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

const ENTERED_FIELD: Readonly<Record<EnteredCheckId, PlotLimitField>> = {
  'boundary-setback': 'boundarySetbackM',
  'road-setback': 'roadSetbackM',
  'open-space-minimum': 'minOpenSpaceShare',
}

function unlessUnentered(id: EnteredCheckId, check: Check | null, { pack, plot }: Solution, notes: readonly Cite[]): Check[] {
  const unentered = ENTERED_FIELD[id]
  if (!isUnentered(pack, plot.limits, unentered) || check?.status === 'fail') return check ? [check] : []
  return [{ id, status: 'manual', unentered, cites: [...(check?.cites ?? []), ...notes] }]
}

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
    largestFloorSqm: plates.floors.reduce((largest, f) => Math.max(largest, f.areaSqm), 0),
    highRiseOrExtraLarge: isHighRiseOrExtraLarge(solution.pack, building),
  }
}

function openSpaceChecks(facts: DesignFacts): Check[] {
  const { limits, site, farCap, pack } = facts.solution
  const need = openSpaceNeed(facts)
  const openSqm = site.areaSqm - facts.plates.footprintSqm
  const ratio = ratioOpenSpace(limits, need.farSqm)
  const permeable = permeableArea(limits, need, openSqm)
  const minimum = buildingControlOpenSpace(limits, need)
  return [
    measured('far', need.farSqm, 'lte', farCap.maxGfaSqm, 'sqm', farCap.cites),
    ...(limits.openSpace.ratio ? [measured('open-space-ratio', openSqm, 'gte', ratio.value, 'sqm', ratio.cites)] : []),
    ...(limits.openSpace.permeable ? [measured('permeable', openSqm, 'gte', permeable.value, 'sqm', permeable.cites)] : []),
    ...unlessUnentered(
      'open-space-minimum',
      limits.openSpace.minimums.length > 0 ? measured('open-space-minimum', openSqm, 'gte', minimum.value, 'sqm', minimum.cites) : null,
      facts.solution,
      pack.plotOpenSpace?.notes ?? [],
    ),
  ]
}

function setbackChecks({ solution, building, levels }: Context): Check[] {
  const { pack, site } = solution
  const nearest = (edge: number) => Math.min(...levels.map((level) => level.clearanceM[edge]))
  const edges = site.edges.map((edge, i) => ({ ...edge, i }))
  const boundaries = edges.filter((e) => e.roadWidthM === null)
  const roads = edges.flatMap((e) => (e.roadWidthM === null ? [] : [{ ...e, roadWidthM: e.roadWidthM }]))
  const checks: Check[] = []
  const lowRise = lowRiseSetbacks(pack, solution.landAreaSqm, building)
  const plotSetback = (id: EnteredCheckId, check: Check) => (lowRise ? [check] : unlessUnentered(id, check, solution, pack.plotSetbacks?.notes ?? []))
  const rear = rearEdge(site)
  if (boundaries.length > 0) {
    const ordinary = () => strictest([boundarySetback(pack, building, 'boundary'), sideRearOpenSpace(solution.limits.sideRear, building.heightM)])
    const margins = boundaries.map((e) => {
      const required = lowRise ? (e.i === rear ? lowRise.rear : lowRise.side) : ordinary()
      const actual = nearest(e.i)
      return { actual, required, margin: actual - required.distanceM }
    })
    const worst = margins.reduce((least, m) => (m.margin < least.margin ? m : least))
    checks.push(...plotSetback('boundary-setback', measured('boundary-setback', worst.actual, 'gte', worst.required.distanceM, 'm', worst.required.cites)))
  }
  const roadMargins = roads.map((e) => {
    const required = lowRise ? lowRise.front : strictest([roadSetback(pack, building, e.roadWidthM), boundarySetback(pack, building, 'road')])
    const actual = nearest(e.i)
    return { actual, required, margin: actual - required.distanceM }
  })
  const worstRoad = roadMargins.reduce((worst, r) => (r.margin < worst.margin ? r : worst))
  checks.push(...plotSetback('road-setback', measured('road-setback', worstRoad.actual, 'gte', worstRoad.required.distanceM, 'm', worstRoad.required.cites)))
  const multiple = solution.limits.height.vsRoadMultiple
  if (!multiple) return checks
  if (multiple.distance === 'streetPlusFrontSpace') {
    const allowedM = streetHeightLimitM(pack, site.edges, multiple.value)
    checks.push(measured('height-vs-road', building.heightM, 'lte', allowedM, 'm', multiple.cites))
    return checks
  }
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

function roadFacingShare({ solution, plates }: DesignFacts, frontOpenSpace: FrontOpenSpace): number {
  const { site } = solution
  const roads = site.edges.flatMap((e, i) => (e.roadWidthM === null ? [] : [siteEdge(solution, i)]))
  const outline = outerSegments(plates.footprint)
  const facesRoad = (segment: Segment) =>
    roads.some(
      (road) =>
        satisfies(segmentDistance(segment[0], segment[1], road[0], road[1]), frontOpenSpace.exemptIfWithinRoadM) &&
        dot(outwardNormal(segment), outwardNormal(road)) > 0,
    )
  const perimeter = plates.footprint.flatMap((p) => edgeLengths(p.outer)).reduce((sum, m) => sum + m, 0)
  const facing = outline.filter(facesRoad).reduce((sum, [p, q]) => sum + Math.hypot(...subtract(q, p)), 0)
  return perimeter > 0 ? facing / perimeter : 0
}

function frontOpenSpaceChecks(facts: Context): Check[] {
  const { solution, building, ground } = facts
  const { frontOpenSpace } = solution.pack
  if (!frontOpenSpace) return []
  const depth = frontOpenSpaceDepth(frontOpenSpace, building.storeys)
  const front = ground.clearanceM[mainRoad(solution.site)]
  const required = measured('front-open-space', front, 'gte', depth.distanceM, 'm', [frontOpenSpace.appliesTo, ...depth.cites])
  if (solution.readings['front-open-space'] === 'always') return [required]
  const exemption = frontOpenSpace.exemptIfFrontageShareOfPerimeter
  const share = roadFacingShare(facts, frontOpenSpace)
  if (!satisfies(share, exemption)) return [required]
  return [measured('front-open-space', share, exemption.cmp, exemption.value, 'ratio', [exemption.cite, frontOpenSpace.exemptIfWithinRoadM.cite])]
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
  const { site, pack } = solution
  const { highRise } = pack
  if (!highRise || !isHighRiseOrExtraLarge(pack, building)) return []
  const { access, farMax, fireLaneWidthM } = highRise
  const band = access.find((b) => inRange(building.floorAreaSqm, b.floorAreaSqm)) ?? access[access.length - 1]
  const frontage = Math.max(0, ...site.edges.map((e) => (e.roadWidthM !== null && satisfies(e.roadWidthM, band.roadWidthM) ? e.lengthM : 0)))
  const fireLane = Math.min(...ground.clearanceM)
  return [
    measured('high-rise-far', programme.farSqm / solution.farAreaSqm, 'lte', farMax.value, 'ratio', [farMax.cite]),
    measured('high-rise-access', frontage, band.frontageM.cmp, band.frontageM.value, 'm', [band.frontageM.cite, band.roadWidthM.cite]),
    manual('high-rise-road-network', [band.roadWidthM.cite, highRise.accessStripWidthM.cite]),
    measured('fire-lane', fireLane, fireLaneWidthM.cmp, fireLaneWidthM.value, 'm', [fireLaneWidthM.cite]),
  ]
}

function farExtraChecks({ solution }: DesignFacts): Check[] {
  const { farCap, limits } = solution
  switch (farCap.mode) {
    case 'standard':
      return []
    case 'bonus':
      return [manual('far-bonus-measures', limits.farBonus.measures.filter((m) => m.eligible).flatMap((m) => m.cites))]
    case 'purchased':
      return [manual('far-purchase', limits.farPurchase.cites)]
  }
}

function coverageChecks({ solution, plates }: DesignFacts): Check[] {
  const { coverage } = solution.limits
  return coverage ? [measured('coverage', plates.footprintSqm, 'lte', coverage.maxFootprintSqm, 'sqm', coverage.cites)] : []
}

function heightCapChecks({ solution, building }: DesignFacts): Check[] {
  const { planLimitM, cites } = solution.limits.height
  return planLimitM === null ? [] : [measured('height-cap', building.heightM, 'lte', planLimitM, 'm', cites)]
}

export function checksFor(facts: DesignFacts): Check[] {
  const [ground, ...upper] = levelsOf(facts)
  const context = { ...facts, ground, levels: [ground, ...upper] }
  return [
    ...openSpaceChecks(context),
    ...farExtraChecks(context),
    ...coverageChecks(context),
    ...heightCapChecks(context),
    ...setbackChecks(context),
    ...frontOpenSpaceChecks(context),
    ...conditionChecks(context),
    ...highRiseChecks(context),
  ]
}
