import { BUILDING_TYPES, type BuildingType } from '@/plot/plot'
import type { Site, SiteEdge } from '@/plot/site'
import type { Bound, Cite, FarBonus, ParkingRule, Range, RulePack } from '@/rules'
import { inRange, satisfies } from './bound'
import { isMember, readingCites, readingSources, type Interpretations } from './interpretations'
import { heightVsRoadMultiple } from './setbacks'

export type Sourced = { readonly value: number; readonly cites: readonly Cite[] }
export type ClassMembership = { readonly member: boolean; readonly cites: readonly Cite[] }

export type BonusMeasure = {
  readonly kind: FarBonus['kind']
  readonly eligible: boolean
  readonly maxShare: number
  readonly cites: readonly Cite[]
}

export type OpenSpaceMinimum = {
  readonly scope: 'anyBuilding' | 'highRiseOrExtraLarge'
  readonly base: 'largestFloorArea' | 'landArea'
  readonly share: number
  readonly cites: readonly Cite[]
}

type RoadAccessTier = RulePack['useConditions']['roadAccessTiers'][number]

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

export type Limits = {
  readonly far: { readonly ratio: number; readonly maxGfaSqm: number; readonly cites: readonly Cite[] }
  readonly farBonus: {
    readonly measures: readonly BonusMeasure[]
    readonly maxShare: number
    readonly maxGfaSqm: number
    readonly cites: readonly Cite[]
  }
  readonly classes: { readonly residential: ClassMembership; readonly publicBuilding: ClassMembership }
  readonly openSpace: {
    readonly ratio: Sourced
    readonly permeable: Sourced & { readonly base: Interpretations['permeable-base'] }
    readonly minimums: readonly OpenSpaceMinimum[]
  }
  readonly height: { readonly planLimitM: null; readonly cites: readonly Cite[]; readonly vsRoadMultiple: Sourced }
  readonly use: UseLimit
  readonly highRise: {
    readonly fromHeightM: Bound
    readonly extraLargeFromFloorAreaSqm: Bound
    readonly access: readonly HighRiseAccessBand[]
    readonly fireLaneWidthM: Bound
    readonly farMax: Sourced
  }
  readonly parking: { readonly rules: readonly ParkingRule[]; readonly cites: readonly Cite[] }
}

export type LimitsInput = {
  readonly pack: RulePack
  readonly readings: Interpretations
  readonly site: Site
  readonly buildingType: BuildingType
  readonly nearStation: boolean
}

function bonusMeasure(measure: FarBonus, classes: Limits['classes'], nearStation: boolean): BonusMeasure {
  switch (measure.kind) {
    case 'affordableHousing':
      return {
        kind: measure.kind,
        eligible: classes.residential.member,
        maxShare: measure.maxShare.value,
        cites: [measure.maxShare.cite, ...classes.residential.cites],
      }
    case 'publicOpenSpace':
      return {
        kind: measure.kind,
        eligible: classes.publicBuilding.member,
        maxShare: measure.maxShare.value,
        cites: [measure.zones, measure.maxShare.cite, ...classes.publicBuilding.cites],
      }
    case 'publicParking':
      return {
        kind: measure.kind,
        eligible: classes.publicBuilding.member && nearStation,
        maxShare: measure.maxShare.value,
        cites: [measure.maxStationDistanceM.cite, measure.maxShare.cite, ...classes.publicBuilding.cites],
      }
    case 'floodRetention':
      return { kind: measure.kind, eligible: true, maxShare: measure.maxShare.value, cites: [measure.maxShare.cite] }
    case 'energyRating': {
      const top = measure.levels.reduce((best, level) => (level.share.value > best.share.value ? level : best))
      return { kind: measure.kind, eligible: true, maxShare: top.share.value, cites: [top.share.cite] }
    }
  }
}

function farLimits({ pack, site, nearStation }: LimitsInput, classes: Limits['classes']): Pick<Limits, 'far' | 'farBonus'> {
  const ratio = pack.far.max.value
  const maxGfaSqm = ratio * site.areaSqm
  const measures = pack.farBonus.measures.map((m) => bonusMeasure(m, classes, nearStation))
  const eligibleShare = measures.filter((m) => m.eligible).reduce((sum, m) => sum + m.maxShare, 0)
  const maxShare = Math.min(pack.farBonus.combinedMaxShare.value, eligibleShare)
  return {
    far: { ratio, maxGfaSqm, cites: [pack.far.max.cite, pack.far.definition, pack.far.subdividedPlotsShareCap] },
    farBonus: { measures, maxShare, maxGfaSqm: maxGfaSqm * (1 + maxShare), cites: [pack.farBonus.combinedMaxShare.cite] },
  }
}

function openSpaceLimits({ pack, readings }: LimitsInput, residential: ClassMembership): Limits['openSpace'] {
  const osr = pack.openSpaceRatio
  const base = readings['open-space-base']
  const sources = readingSources(pack, 'open-space-base', base)
  const use = residential.member ? 'residential' : 'nonResidential'
  const minimums = pack.openSpaceMinimums
    .filter((m) => m.use === use && sources.has(m.minShare.cite.source))
    .map((m) => ({
      scope: m.scope,
      base: m.base,
      share: m.minShare.value,
      cites: [m.minShare.cite, osr.notBelowBuildingControl, ...residential.cites, ...readingCites(pack, 'open-space-base', base)],
    }))
  const permeableBase = readings['permeable-base']
  return {
    ratio: { value: osr.minShareOfFloorArea.value, cites: [osr.minShareOfFloorArea.cite, osr.definition] },
    permeable: {
      value: osr.permeableShareOfOpenSpace.value,
      base: permeableBase,
      cites: [osr.permeableShareOfOpenSpace.cite, ...readingCites(pack, 'permeable-base', permeableBase)],
    },
    minimums,
  }
}

function accessTierFor(pack: RulePack, roadWidthM: Bound): RoadAccessTier | null {
  const tiers = pack.useConditions.roadAccessTiers.filter((tier) => satisfies(roadWidthM.value, tier.roadWidthM))
  return tiers.reduce<RoadAccessTier | null>((best, tier) => (!best || tier.roadWidthM.value > best.roadWidthM.value ? tier : best), null)
}

function roadExemption({ pack, readings, site }: LimitsInput, roadWidthM: Bound): Exemption {
  const reading = readings['road-access-tiers']
  const tier = reading === 'frontage-and-row' ? accessTierFor(pack, roadWidthM) : null
  const qualifies = (edge: SiteEdge) =>
    edge.roadWidthM !== null && satisfies(edge.roadWidthM, roadWidthM) && (!tier || satisfies(edge.lengthM, tier.frontageM))
  const edge = site.edges.findIndex(qualifies)
  if (edge < 0) return { kind: 'none' }
  const tierCites = tier ? [tier.roadWidthM.cite, tier.frontageM.cite] : []
  return { kind: 'road', edge, tier, cites: [roadWidthM.cite, ...tierCites, ...readingCites(pack, 'road-access-tiers', reading)] }
}

function conditionLimit(input: LimitsInput): UseLimit {
  const { pack, buildingType, nearStation } = input
  const condition = pack.useConditions[buildingType]
  if (condition.kind === 'notListed') return { kind: 'permitted', cites: [condition.absent.from, condition.absent.to] }
  const station: Exemption = {
    kind: 'station',
    cites: [condition.unlessStationDistanceM.cite, pack.useConditions.stationDistanceFrom],
  }
  return {
    kind: 'restricted',
    measure: condition.measure,
    threshold: condition.threshold,
    roadWidthM: condition.unlessRoadWidthM,
    exemption: nearStation ? station : roadExemption(input, condition.unlessRoadWidthM),
    cites: [condition.threshold.cite],
  }
}

function highRiseLimits({ pack, site }: LimitsInput): Limits['highRise'] {
  const qualifies = (roadWidthM: Bound, frontageM: Bound) =>
    site.edges.some((e) => e.roadWidthM !== null && satisfies(e.roadWidthM, roadWidthM) && satisfies(e.lengthM, frontageM))
  return {
    fromHeightM: pack.buildingClasses.highRiseFromHeightM,
    extraLargeFromFloorAreaSqm: pack.buildingClasses.extraLargeFromFloorAreaSqm,
    access: pack.highRise.access.map((band) => ({ ...band, qualifies: qualifies(band.roadWidthM, band.frontageM) })),
    fireLaneWidthM: pack.highRise.fireLaneWidthM,
    farMax: { value: pack.highRise.farMax.value, cites: [pack.highRise.farMax.cite] },
  }
}

function parkingLimits({ pack, readings }: LimitsInput): Limits['parking'] {
  const reading = readings['parking-source']
  const sources = readingSources(pack, 'parking-source', reading)
  const rules = pack.parking.filter((rule) => sources.has(rule.appliesWhere.source))
  return { rules, cites: [...rules.map((r) => r.appliesWhere), ...readingCites(pack, 'parking-source', reading)] }
}

export function limitsFor(input: LimitsInput): Limits {
  const { pack, readings, buildingType } = input
  const { residential, publicBuilding } = pack.classification[buildingType]
  const classes = { residential: isMember(pack, residential, readings), publicBuilding: isMember(pack, publicBuilding, readings) }
  return {
    ...farLimits(input, classes),
    classes,
    openSpace: openSpaceLimits(input, classes.residential),
    height: {
      planLimitM: null,
      cites: [pack.zone.noPlanHeightLimit.from, pack.zone.noPlanHeightLimit.to],
      vsRoadMultiple: heightVsRoadMultiple(pack),
    },
    use: conditionLimit(input),
    highRise: highRiseLimits(input),
    parking: parkingLimits(input),
  }
}

export function stationDistance(pack: RulePack): Bound {
  for (const type of BUILDING_TYPES) {
    const condition = pack.useConditions[type]
    if (condition.kind === 'restrictedAbove') return condition.unlessStationDistanceM
  }
  throw new Error('the pack has no use condition with a station distance')
}

export function highRiseAllows(limits: Limits, floorAreaSqm: number): boolean {
  return limits.highRise.access.some((band) => band.qualifies && inRange(floorAreaSqm, band.floorAreaSqm))
}
