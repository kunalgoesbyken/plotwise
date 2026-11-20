import { intersection, shrink } from './clip'
import { GeometryError } from './errors'
import { edgeLengths, totalArea, type Polygon } from './polygon'
import { LENGTH_TOLERANCE_M } from './tolerance'
import type { Prism } from './volume'

const CAP_UNDERSHOOT = 1e-3

export type FootprintLimits = { readonly footprint?: readonly Polygon[]; readonly maxFootprintSqm?: number }

export type Floor = {
  readonly level: number
  readonly baseM: number
  readonly topM: number
  readonly polygons: readonly Polygon[]
  readonly areaSqm: number
}

export type FloorPlates = {
  readonly footprint: readonly Polygon[]
  readonly footprintSqm: number
  readonly floors: readonly Floor[]
  readonly gfaSqm: number
}

const toCents = (sqm: number) => Math.round(sqm * 100)

function assertInputs(floorToFloorM: number, maxFootprintSqm: number | undefined): void {
  if (!(Number.isFinite(floorToFloorM) && floorToFloorM > 0)) {
    throw new GeometryError('invalid-floor-height', 'floor-to-floor height must be a positive number of metres')
  }
  if (maxFootprintSqm !== undefined && !(Number.isFinite(maxFootprintSqm) && maxFootprintSqm >= 0)) {
    throw new GeometryError('invalid-cap', 'the footprint cap must be a non-negative area')
  }
}

const perimeter = (polygons: readonly Polygon[]) =>
  polygons.flatMap((p) => [p.outer, ...p.holes]).reduce((sum, loop) => sum + edgeLengths(loop).reduce((a, b) => a + b, 0), 0)

function capArea(polygons: readonly Polygon[], maxSqm: number): readonly Polygon[] {
  const targetSqm = maxSqm * (1 - CAP_UNDERSHOOT)
  let [inset, capped] = [0, polygons]
  while (totalArea(capped) > maxSqm) {
    inset += (totalArea(capped) - targetSqm) / perimeter(capped)
    capped = shrink(polygons, inset)
  }
  return capped
}

const CENT_SQM = 0.01
const PLATE_SEARCH_STEPS = 40

type Trial = { readonly insetM: number; readonly polygons: readonly Polygon[]; readonly areaSqm: number }

function trial(polygons: readonly Polygon[], insetM: number): Trial {
  const shrunk = shrink(polygons, insetM)
  return { insetM, polygons: shrunk, areaSqm: totalArea(shrunk) }
}

function nextInset(over: Trial, under: Trial | null, goalSqm: number): number {
  if (!under) return over.insetM + (over.areaSqm - goalSqm) / perimeter(over.polygons)
  const secant = over.insetM + ((over.areaSqm - goalSqm) * (under.insetM - over.insetM)) / (over.areaSqm - under.areaSqm)
  return secant > over.insetM && secant < under.insetM ? secant : (over.insetM + under.insetM) / 2
}

function insetToArea(polygons: readonly Polygon[], maxSqm: number): readonly Polygon[] {
  const [highest, lowest] = [maxSqm - CENT_SQM / 2, maxSqm - CENT_SQM]
  let over: Trial = { insetM: 0, polygons, areaSqm: totalArea(polygons) }
  let under: Trial | null = null
  for (let step = 0; step < PLATE_SEARCH_STEPS; step++) {
    const next = trial(polygons, nextInset(over, under, (highest + lowest) / 2))
    if (next.areaSqm > highest) over = next
    else if (next.areaSqm >= lowest) return next.polygons
    else under = next
  }
  return under?.polygons ?? []
}

export function shrinkFloor(floor: Floor, maxSqm: number): Floor {
  if (floor.areaSqm <= maxSqm) return floor
  const polygons = maxSqm > CENT_SQM ? insetToArea(floor.polygons, maxSqm) : []
  return { ...floor, polygons, areaSqm: toCents(totalArea(polygons)) / 100 }
}

function limitFootprint(ground: readonly Polygon[], { footprint, maxFootprintSqm }: FootprintLimits): readonly Polygon[] {
  const clipped = footprint ? intersection(ground, footprint) : ground
  return maxFootprintSqm === undefined ? clipped : capArea(clipped, maxFootprintSqm)
}

function platesPerPrism(volume: readonly Prism[], limits: FootprintLimits): (readonly Polygon[])[] {
  if (limits.footprint === undefined && limits.maxFootprintSqm === undefined) return volume.map((p) => p.polygons)
  const footprint = limitFootprint(volume[0].polygons, limits)
  return volume.map((prism, i) => (i === 0 ? footprint : intersection(prism.polygons, footprint)))
}

function stackFloors(volume: readonly Prism[], plates: readonly (readonly Polygon[])[], floorToFloorM: number): Floor[] {
  const groundM = volume[0].baseM
  const count = Math.floor((volume[volume.length - 1].topM - groundM + LENGTH_TOLERANCE_M) / floorToFloorM)
  const floors: Floor[] = []
  for (let level = 0; level < count; level++) {
    const [baseM, topM] = [groundM + level * floorToFloorM, groundM + (level + 1) * floorToFloorM]
    const polygons = plates[volume.findLastIndex((prism) => prism.baseM < topM - LENGTH_TOLERANCE_M)]
    if (polygons.length === 0) break
    floors.push({ level, baseM, topM, polygons, areaSqm: toCents(totalArea(polygons)) / 100 })
  }
  return floors
}

export function floorPlates(volume: readonly Prism[], floorToFloorM: number, limits: FootprintLimits = {}): FloorPlates {
  assertInputs(floorToFloorM, limits.maxFootprintSqm)
  if (volume.length === 0) return { footprint: [], footprintSqm: 0, floors: [], gfaSqm: 0 }
  const plates = platesPerPrism(volume, limits)
  const floors = stackFloors(volume, plates, floorToFloorM)
  return {
    footprint: plates[0],
    footprintSqm: toCents(totalArea(plates[0])) / 100,
    floors,
    gfaSqm: floors.reduce((cents, floor) => cents + toCents(floor.areaSqm), 0) / 100,
  }
}
