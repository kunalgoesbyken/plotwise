import type { Vec2 } from '@/geo/projection'
import {
  centroid,
  contains,
  dot,
  floorPlates,
  length,
  polygonArea,
  subtract,
  type Floor,
  type FloorPlates,
  type Polygon,
  type Prism,
} from '@/geometry'
import { ASSUMPTIONS, footprintCapSqm, mainRoad, type Envelope, type Solution } from '@/solve'
import { programme } from './programme'

export type TypologyId = 'podium-tower' | 'slab' | 'low-rise'

export type Massing = { readonly envelope: Envelope; readonly plates: FloorPlates }

type RoadFrame = { readonly origin: Vec2; readonly along: Vec2; readonly inward: Vec2 }
type Extent = { readonly minAlong: number; readonly maxAlong: number; readonly minIn: number; readonly maxIn: number }

function roadFrame({ site }: Solution): RoadFrame {
  const edge = mainRoad(site)
  const [origin, end] = [site.ring[edge], site.ring[(edge + 1) % site.ring.length]]
  const direction = subtract(end, origin)
  const along: Vec2 = [direction[0] / length(direction), direction[1] / length(direction)]
  return { origin, along, inward: [-along[1], along[0]] }
}

function inFrame(frame: RoadFrame, point: Vec2): Vec2 {
  const offset = subtract(point, frame.origin)
  return [dot(offset, frame.along), dot(offset, frame.inward)]
}

function extentOf(frame: RoadFrame, polygons: readonly Polygon[]): Extent {
  const points = polygons.flatMap((p) => p.outer).map((p) => inFrame(frame, p))
  const along = points.map(([a]) => a)
  const inward = points.map(([, n]) => n)
  return { minAlong: Math.min(...along), maxAlong: Math.max(...along), minIn: Math.min(...inward), maxIn: Math.max(...inward) }
}

function rectangle(frame: RoadFrame, alongFrom: number, alongTo: number, inFrom: number, inTo: number): Polygon {
  const at = (a: number, n: number): Vec2 => [
    frame.origin[0] + a * frame.along[0] + n * frame.inward[0],
    frame.origin[1] + a * frame.along[1] + n * frame.inward[1],
  ]
  return { outer: [at(alongFrom, inFrom), at(alongTo, inFrom), at(alongTo, inTo), at(alongFrom, inTo)], holes: [] }
}

function centred(frame: RoadFrame, [along, inward]: Vec2, halfAlong: number, halfIn: number): Polygon {
  return rectangle(frame, along - halfAlong, along + halfAlong, inward - halfIn, inward + halfIn)
}

function envelopeOf(solution: Solution, kind: Envelope['kind']): Envelope | null {
  const envelope = solution.envelopes.find((e) => e.kind === kind)
  return envelope && envelope.prisms.length > 0 ? envelope : null
}

const CAP_SEARCH_STEPS = 30

function reachableSqm({ limits }: Solution, envelope: Envelope): number {
  const maxGfaSqm = limits.far.maxGfaSqm
  return envelope.kind === 'highRise' ? maxGfaSqm : Math.min(maxGfaSqm, limits.highRise.extraLargeFromFloorAreaSqm.value)
}

const storeysOf = (envelope: Envelope) => Math.round(envelope.prisms[envelope.prisms.length - 1].topM / envelope.floorToFloorM)

function footprintCap(solution: Solution, envelope: Envelope): number {
  const { limits, site } = solution
  const targetSqm = reachableSqm(solution, envelope)
  const storeys = storeysOf(envelope)
  const capAt = (farSqm: number) =>
    footprintCapSqm(limits, { landSqm: site.areaSqm, farSqm, highRiseOrExtraLarge: envelope.kind === 'highRise' })
  const fits = (footprintSqm: number) => footprintSqm <= capAt(Math.min(targetSqm, storeys * footprintSqm))
  let [low, high] = [capAt(targetSqm), site.areaSqm]
  if (low * storeys >= targetSqm) return low
  for (let step = 0; step < CAP_SEARCH_STEPS; step++) {
    const mid = (low + high) / 2
    if (fits(mid)) low = mid
    else high = mid
  }
  return low
}

function above(prisms: readonly Prism[], heightM: number): Prism[] {
  return prisms.filter((p) => p.topM > heightM).map((p) => ({ ...p, baseM: Math.max(p.baseM, heightM) }))
}

export function stack(footprint: FloorPlates, floors: readonly Floor[]): FloorPlates {
  const levelled = floors.map((floor, level) => (floor.level === level ? floor : { ...floor, level }))
  const builtCents = levelled.reduce((sum, floor) => sum + Math.round(floor.areaSqm * 100), 0)
  return { footprint: footprint.footprint, footprintSqm: footprint.footprintSqm, floors: levelled, gfaSqm: builtCents / 100 }
}

function lowRise(solution: Solution): Massing | null {
  const envelope = envelopeOf(solution, 'ordinary')
  if (!envelope) return null
  const frame = roadFrame(solution)
  const ground = extentOf(frame, envelope.prisms[0].polygons)
  const [lengthM, depthM] = [ground.maxAlong - ground.minAlong, ground.maxIn - ground.minIn]
  const half = Math.min(1, Math.sqrt(reachableSqm(solution, envelope) / storeysOf(envelope) / (lengthM * depthM))) / 2
  const middle: Vec2 = [(ground.minAlong + ground.maxAlong) / 2, (ground.minIn + ground.maxIn) / 2]
  const block = centred(frame, middle, half * lengthM, half * depthM)
  const limits = { footprint: [block], maxFootprintSqm: footprintCap(solution, envelope) }
  return { envelope, plates: floorPlates(envelope.prisms, envelope.floorToFloorM, limits) }
}

function slab(solution: Solution): Massing | null {
  const envelope = envelopeOf(solution, 'highRise') ?? envelopeOf(solution, 'ordinary')
  if (!envelope) return null
  const frame = roadFrame(solution)
  const ground = extentOf(frame, envelope.prisms[0].polygons)
  const depthM = ASSUMPTIONS.slabDepthM[solution.plot.buildingType].value
  const neededM = (reachableSqm(solution, envelope) / ((ground.maxAlong - ground.minAlong) * depthM)) * envelope.floorToFloorM
  const reaching = envelope.prisms.find((p) => p.topM >= neededM) ?? envelope.prisms[envelope.prisms.length - 1]
  const front = Math.max(ground.minIn, Math.min(extentOf(frame, reaching.polygons).minIn, ground.maxIn - depthM))
  const bar = rectangle(frame, ground.minAlong, ground.maxAlong, front, front + depthM)
  const plates = floorPlates(envelope.prisms, envelope.floorToFloorM, { footprint: [bar], maxFootprintSqm: footprintCap(solution, envelope) })
  return { envelope, plates }
}

function podiumStoreys(solution: Solution, podium: FloorPlates): number {
  const top = podium.floors.at(-1)
  if (!top || podium.footprintSqm === 0) return 0
  const building = { heightM: top.topM, storeys: podium.floors.length, floorAreaSqm: solution.limits.far.maxGfaSqm }
  const parkingSqm = programme(solution, building).parkingSqm
  return Math.min(podium.floors.length, Math.max(1, Math.ceil(parkingSqm / podium.footprintSqm)))
}

const TOWER_FIT_TRIES = 8
const TOWER_SHRINK = 0.85

function inside(frame: RoadFrame, square: { centre: Vec2; half: number }, region: readonly Polygon[]): boolean {
  const corners = centred(frame, square.centre, square.half, square.half).outer
  const covered = (point: Vec2) => region.some((p) => contains(p.outer, point) && !p.holes.some((hole) => contains(hole, point)))
  const strictlyWithin = (point: Vec2) => {
    const [a, n] = inFrame(frame, point)
    return Math.abs(a - square.centre[0]) < square.half && Math.abs(n - square.centre[1]) < square.half
  }
  return corners.every(covered) && !region.some((p) => [p.outer, ...p.holes].some((loop) => loop.some(strictlyWithin)))
}

const largestPolygon = (polygons: readonly Polygon[]) => polygons.reduce((a, b) => (polygonArea(b) > polygonArea(a) ? b : a))

function towerFootprint(solution: Solution, envelope: Envelope, podium: readonly Polygon[]): Polygon | null {
  const frame = roadFrame(solution)
  const centres = envelope.prisms.toReversed().map((prism) => inFrame(frame, centroid(largestPolygon(prism.polygons).outer)))
  let half = Math.sqrt(ASSUMPTIONS.towerPlateSqm[solution.plot.buildingType].value) / 2
  for (let attempt = 0; attempt < TOWER_FIT_TRIES; attempt++, half *= TOWER_SHRINK) {
    const centre = centres.find((c) => inside(frame, { centre: c, half }, podium))
    if (centre) return centred(frame, centre, half, half)
  }
  return null
}

function podiumTower(solution: Solution): Massing | null {
  const envelope = envelopeOf(solution, 'highRise')
  if (!envelope) return null
  const f = envelope.floorToFloorM
  const podium = floorPlates(envelope.prisms, f, { maxFootprintSqm: footprintCap(solution, envelope) })
  const storeys = podiumStoreys(solution, podium)
  const towerVolume = above(envelope.prisms, storeys * f)
  const footprint = towerVolume.length > 0 ? towerFootprint(solution, envelope, podium.footprint) : null
  const tower = footprint ? floorPlates(towerVolume, f, { footprint: [footprint] }) : null
  return { envelope, plates: stack(podium, [...podium.floors.slice(0, storeys), ...(tower?.floors ?? [])]) }
}

export const TYPOLOGIES: Readonly<Record<TypologyId, (solution: Solution) => Massing | null>> = {
  'podium-tower': podiumTower,
  slab,
  'low-rise': lowRise,
}
