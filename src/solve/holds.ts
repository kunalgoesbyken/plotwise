import type { Prism } from '@/geometry'
import type { Site } from '@/plot/site'
import type { RulePack } from '@/rules'
import { highRiseEnvelope, ordinaryEnvelope, type Envelope, type EnvelopeInput, type EnvelopeTier } from './envelope'
import type { Interpretations } from './interpretations'
import type { Limits } from './limits'
import { storeysToHold, type SideRearLimit } from './side-rear'

export type Hold = { readonly storeys: number; readonly envelopes: readonly Envelope[] }

type Basis = {
  readonly pack: RulePack
  readonly readings: Interpretations
  readonly site: Site
  readonly floorToFloorM: number
  readonly limits: Limits
}

function envelopesFor({ pack, readings, site, floorToFloorM, limits }: Basis, heldStoreys: number | null): Envelope[] {
  const input: EnvelopeInput = { pack, readings, site, floorToFloorM, planLimitM: limits.height.planLimitM, sideRear: limits.sideRear, heldStoreys }
  const highRisePermitted = limits.highRise?.access.some((band) => band.qualifies) ?? false
  return [ordinaryEnvelope(input), ...(highRisePermitted ? [highRiseEnvelope(input)] : [])]
}

const topStoreys = (envelopes: readonly Envelope[], floorToFloorM: number) =>
  Math.max(0, ...envelopes.map((e) => Math.round((e.prisms.at(-1)?.topM ?? 0) / floorToFloorM)))

function holdsFor(basis: Basis, sideRear: SideRearLimit, maxStoreys: number): Hold[] {
  const holds: Hold[] = []
  for (const storeys of storeysToHold(sideRear, basis.floorToFloorM, maxStoreys)) {
    const envelopes = envelopesFor(basis, storeys)
    if (envelopes.every((e) => e.prisms.length === 0)) break
    holds.push({ storeys, envelopes })
  }
  return holds
}

const tierIn = (tier: EnvelopeTier, fromM: number, toM: number): EnvelopeTier[] =>
  tier.toM > fromM && tier.fromM < toM ? [{ ...tier, fromM: Math.max(tier.fromM, fromM), toM: Math.min(tier.toM, toM) }] : []

const prismIn = (prism: Prism, fromM: number, toM: number): Prism[] =>
  prism.topM > fromM && prism.baseM < toM ? [{ ...prism, baseM: Math.max(prism.baseM, fromM), topM: Math.min(prism.topM, toM) }] : []

function unionOf(outer: Envelope, index: number, holds: readonly Hold[]): Envelope {
  const f = outer.floorToFloorM
  const bands = holds.map((hold, i) => ({ fromM: (holds[i - 1]?.storeys ?? 0) * f, toM: hold.storeys * f, held: hold.envelopes[index] }))
  return {
    ...outer,
    tiers: bands.flatMap(({ fromM, toM, held }) => held.tiers.flatMap((tier) => tierIn(tier, fromM, toM))),
    prisms: bands.flatMap(({ fromM, toM, held }) => held.prisms.flatMap((prism) => prismIn(prism, fromM, toM))),
  }
}

export function allowedEnvelopes(basis: Basis): { readonly envelopes: readonly Envelope[]; readonly holds: readonly Hold[] } {
  const outer = envelopesFor(basis, null)
  const { sideRear } = basis.limits
  if (!sideRear) return { envelopes: outer, holds: [] }
  const holds = holdsFor(basis, sideRear, topStoreys(outer, basis.floorToFloorM))
  return { envelopes: outer.map((envelope, i) => unionOf(envelope, i, holds)), holds }
}
