import { BUILDING_TYPES, type BuildingType, type PlotLimits } from '@/plot/plot'
import { mainRoad, type Site, type SiteEdge } from '@/plot/site'
import { isSourceCite, type Bound, type Cite, type ParkingRule, type Range, type RulePack } from '@/rules'
import { inRange, satisfies } from './bound'
import { classesFor, type ClassMembership, type Classes } from './classes'
import { coverageLimit, type CoverageLimit } from './coverage'
import { farLimits, type FarLimits, type InLieu, type PurchaseRatios } from './far'
import { planHeight } from './height'
import { posesQuestion, readingCites, readingSources, type Interpretations } from './interpretations'
import { heightVsRoadMultiple, type HeightVsRoad } from './setbacks'
import { sideRearLimit, type SideRearLimit } from './side-rear'

export type Sourced = { readonly value: number; readonly cites: readonly Cite[] }

export type OpenSpaceMinimum = {
  readonly scope: 'anyBuilding' | 'highRiseOrExtraLarge'
  readonly base: 'largestFloorArea' | 'landArea'
  readonly share: number
  readonly cites: readonly Cite[]
}

type RoadAccessTier = NonNullable<RulePack['useConditions']>['roadAccessTiers'][number]

export type Exemption =
  | { readonly kind: 'none' }
  | { readonly kind: 'station'; readonly cites: readonly Cite[] }
  | { readonly kind: 'road'; readonly edge: number; readonly tier: RoadAccessTier | null; readonly cites: readonly Cite[] }

export type UseLimit =
  | { readonly kind: 'permitted'; readonly cites: readonly Cite[] }
  | {
      readonly kind: 'restricted'
      readonly measure: 'rooms' | 'operatingAreaSqm'
      readonly threshold: Bound
      readonly roadWidthM: Bound
      readonly exemption: Exemption
      readonly cites: readonly Cite[]
    }

export type HighRiseAccessBand = {
  readonly floorAreaSqm: Range
  readonly roadWidthM: Bound
  readonly frontageM: Bound
  readonly qualifies: boolean
}

export type HighRiseLimits = {
  readonly fromHeightM: Bound
  readonly extraLargeFromFloorAreaSqm: Bound
  readonly access: readonly HighRiseAccessBand[]
  readonly fireLaneWidthM: Bound
  readonly farMax: Sourced
}

export type Limits = FarLimits & {
  readonly classes: Classes
  readonly openSpace: {
    readonly ratio: Sourced | null
    readonly permeable: (Sourced & { readonly base: Interpretations['permeable-base'] }) | null
    readonly minimums: readonly OpenSpaceMinimum[]
  }
  readonly height: { readonly planLimitM: number | null; readonly cites: readonly Cite[]; readonly vsRoadMultiple: HeightVsRoad | null }
  readonly sideRear: SideRearLimit | null
  readonly coverage: CoverageLimit | null
  readonly use: UseLimit
  readonly highRise: HighRiseLimits | null
  readonly parking: { readonly rules: readonly ParkingRule[]; readonly cites: readonly Cite[] }
}

export type LimitsInput = {
  readonly pack: RulePack
  readonly readings: Interpretations
  readonly site: Site
  readonly farAreaSqm: number
  readonly buildingType: BuildingType
  readonly nearStation: boolean
  readonly floorToFloorM: number
  readonly plotLimits: PlotLimits | undefined
  readonly purchase: PurchaseRatios
  readonly inLieu: InLieu | null
}

function openSpaceLimits({ pack, readings }: LimitsInput, residential: ClassMembership): Limits['openSpace'] {
  const osr = pack.openSpaceRatio
  const base = readings['open-space-base']
  const sources = readingSources(pack, 'open-space-base', base)
  const filtered = posesQuestion(pack, 'open-space-base')
  const use = residential.member ? 'residential' : 'nonResidential'
  const minimums = pack.openSpaceMinimums
    .filter((m) => m.use === use && (!filtered || (isSourceCite(m.minShare.cite) && sources.has(m.minShare.cite.source))))
    .map((m) => ({
      scope: m.scope,
      base: m.base,
      share: m.minShare.value,
      cites: [m.minShare.cite, ...(osr ? [osr.notBelowBuildingControl] : []), ...residential.cites, ...readingCites(pack, 'open-space-base', base)],
    }))
  const permeableBase = readings['permeable-base']
  return {
    ratio: osr ? { value: osr.minShareOfFloorArea.value, cites: [osr.minShareOfFloorArea.cite, osr.definition] } : null,
    permeable: osr
      ? {
          value: osr.permeableShareOfOpenSpace.value,
          base: permeableBase,
          cites: [osr.permeableShareOfOpenSpace.cite, ...readingCites(pack, 'permeable-base', permeableBase)],
        }
      : null,
    minimums,
  }
}

function accessTierFor(conditions: NonNullable<RulePack['useConditions']>, roadWidthM: Bound): RoadAccessTier | null {
  const tiers = conditions.roadAccessTiers.filter((tier) => satisfies(roadWidthM.value, tier.roadWidthM))
  return tiers.reduce<RoadAccessTier | null>((best, tier) => (!best || tier.roadWidthM.value > best.roadWidthM.value ? tier : best), null)
}

function roadExemption(
  { pack, readings, site }: LimitsInput,
  conditions: NonNullable<RulePack['useConditions']>,
  roadWidthM: Bound,
): Exemption {
  const reading = readings['road-access-tiers']
  const tier = reading === 'frontage-and-row' ? accessTierFor(conditions, roadWidthM) : null
  const qualifies = (edge: SiteEdge) =>
    edge.roadWidthM !== null && satisfies(edge.roadWidthM, roadWidthM) && (!tier || satisfies(edge.lengthM, tier.frontageM))
  const edge = site.edges.findIndex(qualifies)
  if (edge < 0) return { kind: 'none' }
  const tierCites = tier ? [tier.roadWidthM.cite, tier.frontageM.cite] : []
  return { kind: 'road', edge, tier, cites: [roadWidthM.cite, ...tierCites, ...readingCites(pack, 'road-access-tiers', reading)] }
}

function conditionLimit(input: LimitsInput): UseLimit {
  const { pack, buildingType, nearStation } = input
  if (!pack.useConditions) return { kind: 'permitted', cites: [] }
  const conditions = pack.useConditions
  const condition = conditions[buildingType]
  if (condition.kind === 'notListed') return { kind: 'permitted', cites: [condition.absent.from, condition.absent.to] }
  const station = { kind: 'station', cites: [condition.unlessStationDistanceM.cite, conditions.stationDistanceFrom] } as const
  return {
    kind: 'restricted',
    measure: condition.measure,
    threshold: condition.threshold,
    roadWidthM: condition.unlessRoadWidthM,
    exemption: nearStation ? station : roadExemption(input, conditions, condition.unlessRoadWidthM),
    cites: [condition.threshold.cite],
  }
}

function highRiseLimits({ pack, site }: LimitsInput): HighRiseLimits | null {
  const { buildingClasses, highRise } = pack
  if (!buildingClasses || !highRise) return null
  const qualifies = (roadWidthM: Bound, frontageM: Bound) =>
    site.edges.some((e) => e.roadWidthM !== null && satisfies(e.roadWidthM, roadWidthM) && satisfies(e.lengthM, frontageM))
  return {
    fromHeightM: buildingClasses.highRiseFromHeightM,
    extraLargeFromFloorAreaSqm: buildingClasses.extraLargeFromFloorAreaSqm,
    access: highRise.access.map((band) => ({ ...band, qualifies: qualifies(band.roadWidthM, band.frontageM) })),
    fireLaneWidthM: highRise.fireLaneWidthM,
    farMax: { value: highRise.farMax.value, cites: [highRise.farMax.cite] },
  }
}

function parkingLimits({ pack, readings }: LimitsInput): Limits['parking'] {
  const reading = readings['parking-source']
  const sources = readingSources(pack, 'parking-source', reading)
  const rules = posesQuestion(pack, 'parking-source')
    ? pack.parking.filter((rule) => isSourceCite(rule.appliesWhere) && sources.has(rule.appliesWhere.source))
    : pack.parking
  return { rules, cites: [...rules.map((r) => r.appliesWhere), ...readingCites(pack, 'parking-source', reading)] }
}

export function limitsFor(input: LimitsInput): Limits {
  const { pack, readings, buildingType, site, farAreaSqm, plotLimits, floorToFloorM, nearStation, purchase, inLieu } = input
  const classes = classesFor(pack, readings, buildingType)
  const plan = planHeight(pack, plotLimits, floorToFloorM)
  return {
    ...farLimits({ pack, areaSqm: farAreaSqm, roadWidthM: site.edges[mainRoad(site)].roadWidthM ?? 0, plotLimits, classes, nearStation, purchase, inLieu }),
    classes,
    openSpace: openSpaceLimits(input, classes.residential),
    height: { planLimitM: plan.limitM, cites: plan.cites, vsRoadMultiple: heightVsRoadMultiple(pack) },
    sideRear: sideRearLimit(pack, site),
    coverage: coverageLimit(pack, plotLimits, site.areaSqm),
    use: conditionLimit(input),
    highRise: highRiseLimits(input),
    parking: parkingLimits(input),
  }
}

export function stationDistance(pack: RulePack): Bound | null {
  for (const type of BUILDING_TYPES) {
    const condition = pack.useConditions?.[type]
    if (condition?.kind === 'restrictedAbove') return condition.unlessStationDistanceM
  }
  return null
}

export function highRiseAllows(limits: Limits, floorAreaSqm: number): boolean {
  return limits.highRise?.access.some((band) => band.qualifies && inRange(floorAreaSqm, band.floorAreaSqm)) ?? false
}
