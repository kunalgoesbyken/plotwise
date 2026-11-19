import { tieredEnvelope, type Prism } from '@/geometry'
import type { Site } from '@/plot/site'
import type { Cite, Cited, RulePack } from '@/rules'
import type { Envelope, EnvelopeTier, Setback } from '@/solve'

export const RULE_STEPS = ['plot', 'setbacks', 'height-vs-road', 'high-rise'] as const

export type RuleStep = (typeof RULE_STEPS)[number]
export type CarvingRule = Exclude<RuleStep, 'plot'>

export type CarvingRules = ReadonlyMap<string, CarvingRule>

export const citeKey = ({ source, clause, page, line }: Cite) => `${source}|${clause}|${page}|${line}`

function roadSetbackCites(pack: RulePack): Cite[] {
  return pack.roadSetbacks.flatMap((rule) =>
    rule.bands.map(({ setback }) => (setback.kind === 'fromRoadBoundaryShareOfWidth' ? setback.share.cite : setback.distanceM.cite)),
  )
}

function boundarySetbackCites(pack: RulePack, scope: RulePack['boundarySetbacks'][number]['scope']): Cite[] {
  return pack.boundarySetbacks.filter((rule) => rule.scope === scope).flatMap((rule) => rule.bands.map((band) => band.distanceM.cite))
}

const citesOf = (values: readonly Cited[]) => values.map((v) => v.cite)

export function carvingRules(pack: RulePack): CarvingRules {
  const groups: readonly (readonly [CarvingRule, readonly Cite[]])[] = [
    [
      'setbacks',
      [
        ...roadSetbackCites(pack),
        ...boundarySetbackCites(pack, 'anyBuilding'),
        ...citesOf([pack.frontOpenSpace.depthM, pack.frontOpenSpace.tallDepthM]),
      ],
    ],
    ['height-vs-road', citesOf(pack.heightVsRoad.maxMultipleOfDistance)],
    ['high-rise', boundarySetbackCites(pack, 'highRiseOrExtraLarge')],
  ]
  return new Map(groups.flatMap(([rule, cites]) => cites.map((cite) => [citeKey(cite), rule] as const)))
}

const stepIndex = (step: RuleStep) => RULE_STEPS.indexOf(step)

export function setbackRule(setback: Setback, rules: CarvingRules): CarvingRule | null {
  const found = setback.cites.flatMap((cite) => rules.get(citeKey(cite)) ?? [])
  if (found.length === 0) return null
  return found.reduce((first, rule) => (stepIndex(rule) < stepIndex(first) ? rule : first))
}

export function bindingRules(envelope: Envelope, rules: CarvingRules): ReadonlySet<CarvingRule> {
  return new Set(envelope.tiers.flatMap((tier) => tier.setbacks.flatMap((s) => (s.distanceM > 0 ? (setbackRule(s, rules) ?? []) : []))))
}

const carvesBy = (tier: EnvelopeTier, rule: CarvingRule, rules: CarvingRules) =>
  tier.setbacks.filter((s) => s.distanceM > 0 && setbackRule(s, rules) === rule)

export function setbacksOf(envelope: Envelope, rule: CarvingRule, rules: CarvingRules): Setback[] {
  return envelope.tiers.flatMap((tier) => carvesBy(tier, rule, rules))
}

export function firstTierOf(envelope: Envelope, rule: CarvingRule, rules: CarvingRules): EnvelopeTier | undefined {
  return envelope.tiers.find((tier) => carvesBy(tier, rule, rules).length > 0)
}

function carvedBy(setback: Setback, step: RuleStep, rules: CarvingRules): boolean {
  const rule = setbackRule(setback, rules)
  return rule !== null && stepIndex(rule) <= stepIndex(step)
}

export function envelopeAt(envelope: Envelope, site: Site, step: RuleStep, rules: CarvingRules): readonly Prism[] {
  const setbacks = envelope.tiers.map((tier) => tier.setbacks.map((s) => (carvedBy(s, step, rules) ? s.distanceM : 0)))
  const complete = envelope.tiers.every((tier, i) => tier.setbacks.every((s, e) => s.distanceM === setbacks[i][e]))
  if (complete) return envelope.prisms
  return tieredEnvelope(
    site.ring,
    envelope.tiers.map((tier, i) => ({ fromM: tier.fromM, toM: tier.toM, setbacks: setbacks[i] })),
  )
}

export type EnvelopeLayers = {
  readonly steps: readonly RuleStep[]
  readonly step: RuleStep
  readonly shown: readonly Prism[]
  readonly carved: readonly Prism[] | null
}

export function envelopeLayers(envelope: Envelope, site: Site, chosen: RuleStep, rules: CarvingRules): EnvelopeLayers {
  const binding = bindingRules(envelope, rules)
  const steps = RULE_STEPS.filter((step) => step === 'plot' || binding.has(step))
  const reached = steps.filter((step) => stepIndex(step) <= stepIndex(chosen))
  const step = reached[reached.length - 1]
  const before = reached.at(-2)
  return {
    steps,
    step,
    shown: envelopeAt(envelope, site, step, rules),
    carved: before ? envelopeAt(envelope, site, before, rules) : null,
  }
}
