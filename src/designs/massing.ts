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
import { mainRoad } from '@/plot/site'
import type { Bound } from '@/rules'
import { ASSUMPTIONS, footprintCapSqm, satisfies, type Envelope, type Solution } from '@/solve'
import { programme } from './programme'

export type TypologyId = 'podium-tower' | 'slab' | 'low-rise'

export type Form = 'podium-tower' | 'slab' | 'block'

export type Shape = { readonly form: Exclude<Form, 'podium-tower'> } | { readonly form: 'podium-tower'; readonly podiumStoreys: number }

export type Massing = { readonly envelope: Envelope; readonly plates: FloorPlates; readonly shape: Shape }

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

type BlockTarget = { readonly kind: 'cap'; readonly sqm: number } | { readonly kind: 'class'; readonly bound: Bound }

function blockTarget({ limits, farCap }: Solution): BlockTarget {
  const extraLarge = limits.highRise?.extraLargeFromFloorAreaSqm
  return extraLarge && extraLarge.value < farCap.maxGfaSqm ? { kind: 'class', bound: extraLarge } : { kind: 'cap', sqm: farCap.maxGfaSqm }
}

const goalOf = (target: BlockTarget) => (target.kind === 'cap' ? target.sqm : target.bound.value)

const reachableSqm = (solution: Solution, envelope: Envelope) =>
  envelope.kind === 'highRise' ? solution.farCap.maxGfaSqm : goalOf(blockTarget(solution))

const storeysOf = (envelope: Envelope) => Math.round(envelope.prisms[envelope.prisms.length - 1].topM / envelope.floorToFloorM)

function openSpaceFootprintCap(solution: Solution, envelope: Envelope): number {
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

const footprintCap = (solution: Solution, envelope: Envelope) =>
  Math.min(openSpaceFootprintCap(solution, envelope), solution.limits.coverage?.maxFootprintSqm ?? Infinity)

function above(prisms: readonly Prism[], heightM: number): Prism[] {
  return prisms.filter((p) => p.topM > heightM).map((p) => ({ ...p, baseM: Math.max(p.baseM, heightM) }))
}

export function stack(floors: readonly Floor[]): FloorPlates {
  const levelled = floors.map((floor, level) => (floor.level === level ? floor : { ...floor, level }))
  const builtCents = levelled.reduce((sum, floor) => sum + Math.round(floor.areaSqm * 100), 0)
  return { footprint: levelled[0]?.polygons ?? [], footprintSqm: levelled[0]?.areaSqm ?? 0, floors: levelled, gfaSqm: builtCents / 100 }
}

const BLOCK_SEARCH_STEPS = 8
const BLOCK_PRECISION_FLOOR_SHARE = 0.05

const crosses = (target: BlockTarget, gfaSqm: number) => (target.kind === 'cap' ? gfaSqm >= target.sqm : satisfies(gfaSqm, target.bound))

type Probe = { readonly share: number; readonly root: number }

function nextShare(previous: Probe | null, current: Probe, aimSqm: number, gfaSqm: number): number {
  if (!previous || previous.root === current.root) return current.share * Math.sqrt(aimSqm / gfaSqm)
  return current.share - (current.root * (current.share - previous.share)) / (current.root - previous.root)
}

function blockPlates(platesAt: (share: number) => FloorPlates, target: BlockTarget, guess: number, precisionSqm: number): FloorPlates {
  const goalSqm = goalOf(target)
  const aimSqm = target.kind === 'cap' ? goalSqm + precisionSqm : goalSqm - precisionSqm / 2
  let [lowShare, highShare, share] = [0, Infinity, guess]
  let best: FloorPlates | null = null
  let previous: Probe | null = null
  for (let count = 1; ; count++) {
    const plates = platesAt(share)
    if (crosses(target, plates.gfaSqm)) {
      if (target.kind === 'cap') return plates
      highShare = share
    } else {
      best = best && best.gfaSqm >= plates.gfaSqm ? best : plates
      lowShare = share
      if (share >= 1 || (target.kind === 'class' && goalSqm - plates.gfaSqm <= precisionSqm)) return best
    }
    if (count === BLOCK_SEARCH_STEPS) return best ?? plates
    const current = { share, root: Math.sqrt(plates.gfaSqm) - Math.sqrt(aimSqm) }
    const next = nextShare(previous, current, aimSqm, plates.gfaSqm)
    previous = current
    share = next > lowShare && next < highShare ? Math.min(1, next) : (lowShare + Math.min(1, highShare)) / 2
  }
}

function lowRise(solution: Solution): Massing | null {
  const envelope = envelopeOf(solution, 'ordinary')
  if (!envelope) return null
  const frame = roadFrame(solution)
  const ground = extentOf(frame, envelope.prisms[0].polygons)
  const [lengthM, depthM] = [ground.maxAlong - ground.minAlong, ground.maxIn - ground.minIn]
  const target = blockTarget(solution)
  const goalSqm = goalOf(target)
  const middle: Vec2 = [(ground.minAlong + ground.maxAlong) / 2, (ground.minIn + ground.maxIn) / 2]
  const maxFootprintSqm = footprintCap(solution, envelope)
  const platesAt = (share: number) =>
    floorPlates(envelope.prisms, envelope.floorToFloorM, { footprint: [centred(frame, middle, (share * lengthM) / 2, (share * depthM) / 2)], maxFootprintSqm })
  const floorSqm = goalSqm / storeysOf(envelope)
  const guess = Math.min(1, Math.sqrt(floorSqm / (lengthM * depthM)))
  return { envelope, plates: blockPlates(platesAt, target, guess, floorSqm * BLOCK_PRECISION_FLOOR_SHARE), shape: { form: 'block' } }
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
  return { envelope, plates, shape: { form: 'slab' } }
}

function podiumStoreys(solution: Solution, podium: FloorPlates): number {
  const top = podium.floors.at(-1)
  if (!top || podium.footprintSqm === 0) return 0
  const building = { heightM: top.topM, storeys: podium.floors.length, floorAreaSqm: solution.farCap.maxGfaSqm }
  const parkingSqm = programme(solution, building).parkingSqm
  return Math.min(podium.floors.length, Math.max(1, Math.ceil(parkingSqm / podium.footprintSqm)))
}

const TOWER_SEARCH_STEPS = 10
const MIN_TOWER_SIDE_SHARE = 0.3

const covers = (region: readonly Polygon[], point: Vec2) =>
  region.some((p) => contains(p.outer, point) && !p.holes.some((hole) => contains(hole, point)))

function edgeMeetsSquare([x1, y1]: Vec2, [x2, y2]: Vec2, [a, n]: Vec2, half: number): boolean {
  if (Math.max(x1, x2) < a - half || Math.min(x1, x2) > a + half || Math.max(y1, y2) < n - half || Math.min(y1, y2) > n + half) return false
  const slabs: readonly (readonly [number, number])[] = [
    [x1 - x2, x1 - (a - half)],
    [x2 - x1, a + half - x1],
    [y1 - y2, y1 - (n - half)],
    [y2 - y1, n + half - y1],
  ]
  let [from, to] = [0, 1]
  for (const [p, q] of slabs) {
    if (p === 0) {
      if (q < 0) return false
      continue
    }
    if (p < 0) from = Math.max(from, q / p)
    else to = Math.min(to, q / p)
    if (from > to) return false
  }
  return true
}

function clearOfBoundary(region: readonly Polygon[], centre: Vec2, half: number): boolean {
  const meets = (loop: readonly Vec2[]) => loop.some((v, i) => edgeMeetsSquare(v, loop[(i + 1) % loop.length], centre, half))
  return !region.some((p) => meets(p.outer) || p.holes.some(meets))
}

function largestHalf(region: readonly Polygon[], centre: Vec2, maxHalf: number): number {
  if (!covers(region, centre)) return 0
  if (clearOfBoundary(region, centre, maxHalf)) return maxHalf
  let [fits, fails] = [0, maxHalf]
  for (let step = 0; step < TOWER_SEARCH_STEPS; step++) {
    const half = (fits + fails) / 2
    if (clearOfBoundary(region, centre, half)) fits = half
    else fails = half
  }
  return fits
}

function reachM(prisms: readonly Prism[], centre: Vec2): number {
  const stop = prisms.findIndex((prism) => !covers(prism.polygons, centre))
  return stop === -1 ? prisms[prisms.length - 1].topM : stop === 0 ? 0 : prisms[stop - 1].topM
}

const largestPolygon = (polygons: readonly Polygon[]) => polygons.reduce((a, b) => (polygonArea(b) > polygonArea(a) ? b : a))

function towerFootprint(solution: Solution, envelope: Envelope, podium: readonly Polygon[]): Polygon | null {
  const frame = roadFrame(solution)
  const toFrame = (loop: readonly Vec2[]) => loop.map((point) => inFrame(frame, point))
  const region = podium.map((p) => ({ outer: toFrame(p.outer), holes: p.holes.map(toFrame) }))
  const maxHalf = Math.sqrt(ASSUMPTIONS.towerPlateSqm[solution.plot.buildingType].value) / 2
  const options = envelope.prisms.map((prism) => {
    const centre = centroid(largestPolygon(prism.polygons).outer)
    const half = largestHalf(region, inFrame(frame, centre), maxHalf)
    return { centre, half, score: half * half * reachM(envelope.prisms, centre) }
  })
  const best = options.filter((o) => o.half >= maxHalf * MIN_TOWER_SIDE_SHARE).reduce<(typeof options)[number] | null>((a, b) => (a && a.score >= b.score ? a : b), null)
  return best ? centred(frame, inFrame(frame, best.centre), best.half, best.half) : null
}

function podiumTower(solution: Solution): Massing | null {
  const envelope = envelopeOf(solution, 'highRise')
  if (!envelope) return null
  const f = envelope.floorToFloorM
  const podium = floorPlates(envelope.prisms, f, { maxFootprintSqm: footprintCap(solution, envelope) })
  const storeys = podiumStoreys(solution, podium)
  const towerVolume = above(envelope.prisms, storeys * f)
  const footprint = towerVolume.length > 0 ? towerFootprint(solution, envelope, podium.footprint) : null
  const towerFloors = footprint ? floorPlates(towerVolume, f, { footprint: [footprint] }).floors : []
  const shape: Shape = towerFloors.length > 0 ? { form: 'podium-tower', podiumStoreys: storeys } : { form: 'block' }
  return { envelope, plates: stack([...podium.floors.slice(0, storeys), ...towerFloors]), shape }
}

export const TYPOLOGIES: Readonly<Record<TypologyId, (solution: Solution) => Massing | null>> = {
  'podium-tower': podiumTower,
  slab,
  'low-rise': lowRise,
}
