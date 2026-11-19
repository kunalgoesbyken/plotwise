import type { FloorPlates } from '@/geometry'
import {
  highRiseAllows,
  isHighRiseOrExtraLarge,
  negate,
  compare,
  type Building,
  type EnvelopeKind,
  type Solution,
} from '@/solve'
import { checksFor, type Check } from './checks'
import { stack, TYPOLOGIES, type Massing, type TypologyId } from './massing'
import { programme, type Programme, type Yield } from './programme'

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

export type Limiter = 'far' | 'building-class' | 'use' | 'envelope'

export type Design = {
  readonly id: TypologyId
  readonly nameKey: `design.${TypologyId}`
  readonly envelope: EnvelopeKind
  readonly plates: FloorPlates
  readonly metrics: Metrics
  readonly checks: readonly Check[]
  readonly limitedBy: Limiter
}

type Candidate = { readonly building: Building; readonly programme: Programme }

function fitsClass(solution: Solution, kind: EnvelopeKind, building: Building): boolean {
  if (!isHighRiseOrExtraLarge(solution.pack, building)) return true
  return kind === 'highRise' && highRiseAllows(solution.limits, building.floorAreaSqm)
}

function fitsUse({ limits }: Solution, { conditionMeasure }: Programme): boolean {
  const { use } = limits
  if (use.kind === 'permitted' || use.exemption.kind !== 'none') return true
  return compare(conditionMeasure, negate(use.threshold.cmp), use.threshold.value)
}

function limiter(solution: Solution, kind: EnvelopeKind, candidate: Candidate): Limiter | null {
  if (candidate.programme.farSqm > solution.limits.far.maxGfaSqm) return 'far'
  if (!fitsClass(solution, kind, candidate.building)) return 'building-class'
  if (!fitsUse(solution, candidate.programme)) return 'use'
  return null
}

type Fit = Candidate & { readonly storeys: number; readonly limitedBy: Limiter }

function tallestFit(solution: Solution, { envelope, plates }: Massing): Fit | null {
  let best: Fit | null = null
  let builtSqm = 0
  for (const [index, floor] of plates.floors.entries()) {
    builtSqm += floor.areaSqm
    const building = { heightM: floor.topM - plates.floors[0].baseM, storeys: index + 1, floorAreaSqm: builtSqm }
    const candidate = { building, programme: programme(solution, building) }
    const stop = limiter(solution, envelope.kind, candidate)
    if (stop) return best && { ...best, limitedBy: stop }
    best = { ...candidate, storeys: index + 1, limitedBy: 'envelope' }
  }
  return best
}

function metricsOf(solution: Solution, plates: FloorPlates, { building, programme: p }: Candidate): Metrics {
  return {
    gfaSqm: p.farSqm,
    builtSqm: p.builtSqm,
    far: p.farSqm / solution.site.areaSqm,
    heightM: building.heightM,
    storeys: building.storeys,
    footprintSqm: plates.footprintSqm,
    openSpaceSqm: solution.site.areaSqm - plates.footprintSqm,
    parkingSpaces: p.parkingSpaces,
    parkingSqm: p.parkingSqm,
    yield: p.yield,
  }
}

function design(solution: Solution, id: TypologyId): Design | null {
  const massing = TYPOLOGIES[id](solution)
  if (!massing) return null
  const fit = tallestFit(solution, massing)
  if (!fit) return null
  const plates = stack(massing.plates, massing.plates.floors.slice(0, fit.storeys))
  return {
    id,
    nameKey: `design.${id}`,
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
