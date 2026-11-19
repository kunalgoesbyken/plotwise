import { segmentDistance, tieredEnvelope, type Prism, type Tier } from '@/geometry'
import type { Site } from '@/plot/site'
import type { RulePack } from '@/rules'
import { ASSUMPTIONS } from './assumptions'
import { satisfies } from './bound'
import type { Building } from './building'
import type { Interpretations } from './interpretations'
import {
  boundarySetback,
  frontOpenSpaceDepth,
  heightVsRoadMultiple,
  heightVsRoadSetback,
  roadSetback,
  strictest,
  type Setback,
} from './setbacks'

export type EnvelopeKind = 'ordinary' | 'highRise'

export type EnvelopeTier = { readonly fromM: number; readonly toM: number; readonly setbacks: readonly Setback[] }

export type Envelope = {
  readonly kind: EnvelopeKind
  readonly floorToFloorM: number
  readonly tiers: readonly EnvelopeTier[]
  readonly prisms: readonly Prism[]
}

export type EnvelopeInput = {
  readonly pack: RulePack
  readonly readings: Interpretations
  readonly site: Site
  readonly floorToFloorM: number
}

export function mainRoad({ edges }: Site): number {
  return edges.reduce((best, edge, i) => {
    const current = edges[best]
    if (edge.roadWidthM === null) return best
    if (current.roadWidthM === null || edge.roadWidthM > current.roadWidthM) return i
    return edge.roadWidthM === current.roadWidthM && edge.lengthM > current.lengthM ? i : best
  }, 0)
}

function baseSetbacks({ pack, readings, site }: EnvelopeInput, building: Building): Setback[] {
  const front = readings['front-open-space'] === 'always' ? mainRoad(site) : -1
  return site.edges.map((edge, i) => {
    if (edge.roadWidthM === null) return boundarySetback(pack, building, 'boundary')
    const frontSpace = i === front ? [frontOpenSpaceDepth(pack, building.storeys)] : []
    return strictest([roadSetback(pack, building, edge.roadWidthM), boundarySetback(pack, building, 'road'), ...frontSpace])
  })
}

function setbacksAt({ pack, site }: EnvelopeInput, base: readonly Setback[], heightM: number): Setback[] {
  return base.map((setback, i) => {
    const widthM = site.edges[i].roadWidthM
    return widthM === null ? setback : strictest([setback, heightVsRoadSetback(pack, widthM, heightM)])
  })
}

const sameDistances = (a: readonly Setback[], b: readonly Setback[]) => a.every((s, i) => s.distanceM === b[i].distanceM)

function tiersFor(input: EnvelopeInput, base: readonly Setback[], maxStoreys: number): EnvelopeTier[] {
  const f = input.floorToFloorM
  let flat = 0
  while (flat < maxStoreys && sameDistances(setbacksAt(input, base, (flat + 1) * f), base)) flat++
  const pitch = Math.max(1, Math.ceil((maxStoreys - flat) / ASSUMPTIONS.envelopeSteps.value))
  const tiers: EnvelopeTier[] = flat > 0 ? [{ fromM: 0, toM: flat * f, setbacks: base }] : []
  for (let from = flat; from < maxStoreys; from += pitch) {
    const to = Math.min(from + pitch, maxStoreys)
    tiers.push({ fromM: from * f, toM: to * f, setbacks: setbacksAt(input, base, to * f) })
  }
  return tiers
}

function geometryTiers(tiers: readonly EnvelopeTier[]): Tier[] {
  return tiers.map((tier, i) => {
    const below = tiers[i - 1]
    const setbacks = tier.setbacks.map((s, e) => (below && below.setbacks[e].distanceM === s.distanceM ? 0 : s.distanceM))
    return { fromM: tier.fromM, toM: tier.toM, setbacks }
  })
}

function envelope(input: EnvelopeInput, kind: EnvelopeKind, building: Building): Envelope {
  const tiers = tiersFor(input, baseSetbacks(input, building), building.storeys)
  const prisms = tieredEnvelope(input.site.ring, geometryTiers(tiers))
  return { kind, floorToFloorM: input.floorToFloorM, tiers: tiers.slice(0, prisms.length), prisms }
}

export function ordinaryEnvelope(input: EnvelopeInput): Envelope {
  const f = input.floorToFloorM
  const highRise = input.pack.buildingClasses.highRiseFromHeightM
  let storeys = 0
  while (!satisfies((storeys + 1) * f, highRise)) storeys++
  return envelope(input, 'ordinary', { heightM: storeys * f, storeys, floorAreaSqm: 0 })
}

function farthestReachM({ site }: EnvelopeInput, edge: number): number {
  const [a, b] = [site.ring[edge], site.ring[(edge + 1) % site.ring.length]]
  return Math.max(...site.ring.map((p) => segmentDistance(p, p, a, b)))
}

export function highRiseEnvelope(input: EnvelopeInput): Envelope {
  const multiple = heightVsRoadMultiple(input.pack).value
  const topM = Math.min(
    ...input.site.edges.flatMap((edge, i) => (edge.roadWidthM === null ? [] : [multiple * (edge.roadWidthM + farthestReachM(input, i))])),
  )
  const storeys = Math.floor(topM / input.floorToFloorM)
  return envelope(input, 'highRise', { heightM: storeys * input.floorToFloorM, storeys, floorAreaSqm: Infinity })
}
