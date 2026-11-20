import { LENGTH_TOLERANCE_M, shrinkFloor, type Floor, type FloorPlates } from '@/geometry'
import {
  highRiseAllows,
  isHighRiseOrExtraLarge,
  negate,
  compare,
  farCapFor,
  satisfies,
  type Building,
  type EnvelopeKind,
  type Solution,
} from '@/solve'
import { checksFor, type Check } from './checks'
import { stack, TYPOLOGIES, type Form, type Massing, type Shape, type TypologyId } from './massing'
import { programme, type Programme, type Yield } from './programme'

export const AREA_TOLERANCE_SQM = 0.1

const HALF_CENT_SQM = 0.005

export type Metrics = {
  readonly gfaSqm: number
  readonly builtSqm: number
  readonly far: number
  readonly heightM: number
  readonly storeys: number
  readonly footprintSqm: number
  readonly openSpaceSqm: number
  readonly parkingSpaces: number
  readonly parkingSqm: number
  readonly yield: Yield
}

export type Limiter = 'far' | 'building-class' | 'use' | 'height' | 'envelope'

type Stop = Exclude<Limiter, 'far'>

export type DesignName = { readonly form: Form; readonly storeys: number; readonly highRise: boolean }

export type Design = {
  readonly id: TypologyId
  readonly name: DesignName
  readonly envelope: EnvelopeKind
  readonly plates: FloorPlates
  readonly metrics: Metrics
  readonly checks: readonly Check[]
  readonly limitedBy: Limiter
}

type Candidate = { readonly floors: readonly Floor[]; readonly building: Building; readonly programme: Programme }

type Fit = Candidate & { readonly limitedBy: Limiter }

const builtSqmOf = (floors: readonly Floor[]) => floors.reduce((sum, floor) => sum + floor.areaSqm, 0)

function candidate(solution: Solution, floors: readonly Floor[]): Candidate {
  const building = { heightM: floors[floors.length - 1].topM - floors[0].baseM, storeys: floors.length, floorAreaSqm: builtSqmOf(floors) }
  return { floors, building, programme: programme(solution, building) }
}

const overCap = ({ farCap }: Solution, { programme: p }: Candidate) => p.farSqm > farCap.maxGfaSqm

const reachesCap = ({ farCap }: Solution, { programme: p }: Candidate) => farCap.maxGfaSqm - p.farSqm <= AREA_TOLERANCE_SQM

function fitsClass(solution: Solution, kind: EnvelopeKind, building: Building): boolean {
  if (!isHighRiseOrExtraLarge(solution.pack, building)) return true
  return kind === 'highRise' && highRiseAllows(solution.limits, building.floorAreaSqm)
}

function fitsUse({ limits }: Solution, { conditionMeasure }: Programme): boolean {
  const { use } = limits
  if (use.kind === 'permitted' || use.exemption.kind !== 'none') return true
  return compare(conditionMeasure, negate(use.threshold.cmp), use.threshold.value)
}

function blocker(solution: Solution, kind: EnvelopeKind, { building, programme: p }: Candidate): Stop | null {
  if (!fitsClass(solution, kind, building)) return 'building-class'
  if (!fitsUse(solution, p)) return 'use'
  return null
}

function topBlocker(solution: Solution, kind: EnvelopeKind, { building }: Candidate): Stop {
  const taller = { ...building, heightM: building.heightM + solution.floorToFloorM, storeys: building.storeys + 1 }
  if (!fitsClass(solution, kind, taller)) return 'building-class'
  const { planLimitM } = solution.limits.height
  return planLimitM !== null && taller.heightM > planLimitM + LENGTH_TOLERANCE_M ? 'height' : 'envelope'
}

const finish = (solution: Solution, fitted: Candidate, stop: Stop): Fit => ({ ...fitted, limitedBy: reachesCap(solution, fitted) ? 'far' : stop })

function roomUnderCap(solution: Solution, below: readonly Floor[], floor: Floor): number {
  const building = (areaSqm: number) => ({
    heightM: floor.topM - (below[0] ?? floor).baseM,
    storeys: below.length + 1,
    floorAreaSqm: builtSqmOf(below) + areaSqm,
  })
  const fits = (areaSqm: number) => programme(solution, building(areaSqm)).farSqm <= solution.farCap.maxGfaSqm
  let [fitting, over] = [0, floor.areaSqm]
  while (over - fitting > HALF_CENT_SQM) {
    const middle = (fitting + over) / 2
    if (fits(middle)) fitting = middle
    else over = middle
  }
  return fitting
}

function partialTop(solution: Solution, below: readonly Floor[], floor: Floor): Candidate | null {
  const plate = shrinkFloor(floor, roomUnderCap(solution, below, floor))
  if (plate.polygons.length === 0) return null
  const top = candidate(solution, [...below, plate])
  return overCap(solution, top) ? null : top
}

function capped(solution: Solution, kind: EnvelopeKind, fitted: Candidate | null, next: Floor): Fit | null {
  const top = fitted && reachesCap(solution, fitted) ? null : partialTop(solution, fitted?.floors ?? [], next)
  const stop = top && blocker(solution, kind, top)
  if (top && !stop) return { ...top, limitedBy: 'far' }
  return fitted && { ...fitted, limitedBy: stop ?? 'far' }
}

function grow(solution: Solution, { envelope, plates }: Massing): Fit | null {
  let fitted: Candidate | null = null
  for (const floor of plates.floors) {
    const next = candidate(solution, [...(fitted?.floors ?? []), floor])
    if (overCap(solution, next)) return capped(solution, envelope.kind, fitted, floor)
    const stop = blocker(solution, envelope.kind, next)
    if (stop) return fitted && finish(solution, fitted, stop)
    fitted = next
  }
  return fitted && finish(solution, fitted, topBlocker(solution, envelope.kind, fitted))
}

function metricsOf(solution: Solution, plates: FloorPlates, { building, programme: p }: Candidate): Metrics {
  return {
    gfaSqm: p.farSqm,
    builtSqm: p.builtSqm,
    far: p.farSqm / solution.farAreaSqm,
    heightM: building.heightM,
    storeys: building.storeys,
    footprintSqm: plates.footprintSqm,
    openSpaceSqm: solution.site.areaSqm - plates.footprintSqm,
    parkingSpaces: p.parkingSpaces,
    parkingSqm: p.parkingSqm,
    yield: p.yield,
  }
}

function nameOf({ pack }: Solution, shape: Shape, { heightM, storeys }: Building): DesignName {
  const form = shape.form === 'podium-tower' && storeys <= shape.podiumStoreys ? 'block' : shape.form
  const highRise = pack.buildingClasses !== undefined && satisfies(heightM, pack.buildingClasses.highRiseFromHeightM)
  return { form, storeys, highRise }
}

type Placed = { readonly massing: Massing; readonly fit: Fit }

function massingTargets(solution: Solution): Solution[] {
  if (solution.farCap.mode === 'standard') return [solution]
  return [solution, { ...solution, farCap: farCapFor(solution.limits, 'standard') }]
}

function bestPlacement(solution: Solution, id: TypologyId): Placed | null {
  const placements = massingTargets(solution).flatMap((target) => {
    const massing = TYPOLOGIES[id](target)
    const fit = massing && grow(solution, massing)
    return massing && fit ? [{ massing, fit }] : []
  })
  return placements.reduce<Placed | null>((best, next) => (!best || next.fit.programme.farSqm > best.fit.programme.farSqm ? next : best), null)
}

function design(solution: Solution, id: TypologyId): Design | null {
  const placed = bestPlacement(solution, id)
  if (!placed) return null
  const { massing, fit } = placed
  const plates = stack(fit.floors)
  return {
    id,
    name: nameOf(solution, massing.shape, fit.building),
    envelope: massing.envelope.kind,
    plates,
    metrics: metricsOf(solution, plates, fit),
    checks: checksFor({ solution, plates, building: fit.building, programme: fit.programme }),
    limitedBy: fit.limitedBy,
  }
}

export function designs(solution: Solution): Design[] {
  return (Object.keys(TYPOLOGIES) as TypologyId[]).flatMap((id) => design(solution, id) ?? [])
}
