import type { PlotLimits } from '@/plot/plot'
import type { Site } from '@/plot/site'
import { enteredCite, type Cite, type FarBonus, type FarPurchase, type FarRule, type RulePack } from '@/rules'
import { inRange } from './bound'
import type { Classes } from './classes'
import { mainRoad } from './envelope'
import { SolveError } from './errors'

export type FarMode = 'standard' | 'bonus' | 'purchased'

export type FarCap = {
  readonly mode: FarMode
  readonly maxGfaSqm: number
  readonly cites: readonly Cite[]
}

export type BonusMeasure = {
  readonly kind: FarBonus['kind']
  readonly eligible: boolean
  readonly maxShare: number
  readonly cites: readonly Cite[]
}

export type PurchaseOption = {
  readonly kind: FarPurchase['kind']
  readonly maxExtraGfaSqm: number
  readonly pricePerSqm: number | null
  readonly cites: readonly Cite[]
}

export type FarLimits = {
  readonly far: { readonly ratio: number; readonly maxGfaSqm: number; readonly cites: readonly Cite[] }
  readonly farBonus: {
    readonly measures: readonly BonusMeasure[]
    readonly maxShare: number
    readonly extraGfaSqm: number
    readonly maxGfaSqm: number
    readonly cites: readonly Cite[]
  }
  readonly farPurchase: {
    readonly options: readonly PurchaseOption[]
    readonly extraGfaSqm: number
    readonly maxGfaSqm: number
    readonly fullCost: number | null
    readonly cites: readonly Cite[]
  }
}

export type FarInput = {
  readonly pack: RulePack
  readonly site: Site
  readonly plotLimits: PlotLimits | undefined
  readonly classes: Classes
  readonly nearStation: boolean
}

function required<T>(found: T | undefined, what: string): T {
  if (found === undefined) throw new Error(`the pack's ${what} do not cover this plot`)
  return found
}

function baseFar(rule: FarRule, site: Site, plotLimits: PlotLimits | undefined): FarLimits['far'] {
  switch (rule.kind) {
    case 'zone':
      return { ratio: rule.max.value, maxGfaSqm: rule.max.value * site.areaSqm, cites: [rule.max.cite, ...rule.notes] }
    case 'byRoadWidthAndPlotSize': {
      const roadWidthM = site.edges[mainRoad(site)].roadWidthM ?? 0
      const band = required(rule.roadWidthBands.find((b) => inRange(roadWidthM, b.roadWidthM)), 'road width bands')
      const row = required(band.byPlotSize.find((r) => inRange(site.areaSqm, r.plotAreaSqm)), 'plot size bands')
      return { ratio: row.ratio.value, maxGfaSqm: row.ratio.value * site.areaSqm, cites: [row.ratio.cite, ...rule.notes] }
    }
    case 'plotSpecific': {
      const maxGfaSqm = plotLimits?.maxGfaSqm
      if (maxGfaSqm === undefined) throw new SolveError('plot-limit-missing', ['maxGfaSqm'])
      return { ratio: maxGfaSqm / site.areaSqm, maxGfaSqm, cites: [enteredCite('maxGfaSqm'), ...rule.notes] }
    }
  }
}

function bonusMeasure(measure: FarBonus, classes: Classes, nearStation: boolean): BonusMeasure {
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

function bonusLimits({ pack, classes, nearStation }: FarInput, base: FarLimits['far']): FarLimits['farBonus'] {
  const measures = (pack.farBonus?.measures ?? []).map((m) => bonusMeasure(m, classes, nearStation))
  const eligibleShare = measures.filter((m) => m.eligible).reduce((sum, m) => sum + m.maxShare, 0)
  const maxShare = pack.farBonus ? Math.min(pack.farBonus.combinedMaxShare.value, eligibleShare) : 0
  return {
    measures,
    maxShare,
    extraGfaSqm: base.maxGfaSqm * maxShare,
    maxGfaSqm: base.maxGfaSqm * (1 + maxShare),
    cites: pack.farBonus ? [pack.farBonus.combinedMaxShare.cite] : [],
  }
}

function purchaseOption({ cap, price, kind, notes }: FarPurchase, base: FarLimits['far'], site: Site): PurchaseOption {
  const capCite = cap.kind === 'extraRatio' ? cap.ratio.cite : cap.share.cite
  const maxExtraGfaSqm = cap.kind === 'extraRatio' ? cap.ratio.value * site.areaSqm : cap.share.value * base.maxGfaSqm
  const priceCites = price.kind === 'perSqm' ? [price.value.cite] : []
  return {
    kind,
    maxExtraGfaSqm,
    pricePerSqm: price.kind === 'perSqm' ? price.value.value : null,
    cites: [capCite, ...priceCites, ...notes],
  }
}

function purchaseLimits({ pack, site }: FarInput, base: FarLimits['far']): FarLimits['farPurchase'] {
  const options = (pack.farPurchases ?? []).map((purchase) => purchaseOption(purchase, base, site))
  const extraGfaSqm = options.reduce((sum, option) => sum + option.maxExtraGfaSqm, 0)
  const priced = options.every((option) => option.pricePerSqm !== null)
  return {
    options,
    extraGfaSqm,
    maxGfaSqm: base.maxGfaSqm + extraGfaSqm,
    fullCost: priced ? options.reduce((sum, option) => sum + option.maxExtraGfaSqm * (option.pricePerSqm ?? 0), 0) : null,
    cites: options.flatMap((option) => option.cites),
  }
}

export function farLimits(input: FarInput): FarLimits {
  const far = baseFar(input.pack.far, input.site, input.plotLimits)
  return { far, farBonus: bonusLimits(input, far), farPurchase: purchaseLimits(input, far) }
}

export function farCapFor({ far, farBonus, farPurchase }: FarLimits, mode: FarMode): FarCap {
  const standard: FarCap = { mode: 'standard', maxGfaSqm: far.maxGfaSqm, cites: far.cites }
  switch (mode) {
    case 'standard':
      return standard
    case 'bonus':
      return farBonus.extraGfaSqm > 0 ? { mode, maxGfaSqm: farBonus.maxGfaSqm, cites: [...far.cites, ...farBonus.cites] } : standard
    case 'purchased':
      return farPurchase.extraGfaSqm > 0 ? { mode, maxGfaSqm: farPurchase.maxGfaSqm, cites: [...far.cites, ...farPurchase.cites] } : standard
  }
}
