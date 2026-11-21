import type { PlotLimits } from '@/plot/plot'
import { enteredCite, type Cite, type FarBonus, type FarPurchase, type FarRule, type RulePack } from '@/rules'
import { inRange } from './bound'
import type { Classes } from './classes'
import { SolveError } from './errors'

export type FarMode = 'standard' | 'bonus' | 'purchased'

export type PurchaseRatios = Readonly<Partial<Record<FarPurchase['kind'], number>>>

export type FarChoice = { readonly mode: 'standard' } | { readonly mode: 'bonus' } | { readonly mode: 'purchased'; readonly ratios: PurchaseRatios }

export const STANDARD: FarChoice = { mode: 'standard' }

const AS_MUCH_AS_ALLOWED: Readonly<Record<FarPurchase['kind'], number>> = { premium: Infinity, transferableRights: Infinity, fungible: Infinity }

export const EVERY_PURCHASE: FarChoice = { mode: 'purchased', ratios: AS_MUCH_AS_ALLOWED }

export const purchaseRatios =(choice: FarChoice): PurchaseRatios => (choice.mode === 'purchased' ? choice.ratios : {})

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
  readonly chosenGfaSqm: number
  readonly onPermissible: boolean
  readonly price: FarPurchase['price']
  readonly cites: readonly Cite[]
}

export type PurchaseUse = { readonly kind: FarPurchase['kind']; readonly price: FarPurchase['price']; readonly usedGfaSqm: number }

export type InLieu = { readonly gfaSqm: number; readonly cites: readonly Cite[] }

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
    readonly cites: readonly Cite[]
  }
  readonly inLieu: InLieu | null
}

export type FarInput = {
  readonly pack: RulePack
  readonly areaSqm: number
  readonly roadWidthM: number
  readonly plotLimits: PlotLimits | undefined
  readonly classes: Classes
  readonly nearStation: boolean
  readonly purchase: PurchaseRatios
  readonly inLieu: InLieu | null
}

function required<T>(found: T | undefined, what: string): T {
  if (found === undefined) throw new Error(`the pack's ${what} do not cover this plot`)
  return found
}

function baseFar(rule: FarRule, { areaSqm, roadWidthM, plotLimits }: FarInput): FarLimits['far'] {
  switch (rule.kind) {
    case 'zone':
      return { ratio: rule.max.value, maxGfaSqm: rule.max.value * areaSqm, cites: [rule.max.cite, ...rule.notes] }
    case 'byRoadWidthAndPlotSize': {
      const band = required(rule.roadWidthBands.find((b) => inRange(roadWidthM, b.roadWidthM)), 'road width bands')
      const row = required(band.byPlotSize.find((r) => inRange(areaSqm, r.plotAreaSqm)), 'plot size bands')
      return { ratio: row.ratio.value, maxGfaSqm: row.ratio.value * areaSqm, cites: [row.ratio.cite, ...rule.notes] }
    }
    case 'plotSpecific':
      return plotSpecificFar(plotLimits, areaSqm, rule.notes)
  }
}

function plotSpecificFar(plotLimits: PlotLimits | undefined, areaSqm: number, notes: readonly Cite[]): FarLimits['far'] {
  const caps = [
    ...(plotLimits?.maxGfaSqm === undefined ? [] : [{ gfaSqm: plotLimits.maxGfaSqm, cite: enteredCite('maxGfaSqm') }]),
    ...(plotLimits?.maxFar === undefined ? [] : [{ gfaSqm: plotLimits.maxFar * areaSqm, cite: enteredCite('maxFar') }]),
  ]
  if (caps.length === 0) throw new SolveError('plot-limit-missing', ['maxGfaSqm', 'maxFar'])
  const maxGfaSqm = Math.min(...caps.map((cap) => cap.gfaSqm))
  return { ratio: maxGfaSqm / areaSqm, maxGfaSqm, cites: [...caps.map((cap) => cap.cite), ...notes] }
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

type Extra = { readonly gfaSqm: number; readonly cites: readonly Cite[] }

function roadWidthExtra(cap: Extract<FarPurchase['cap'], { kind: 'extraRatioByRoadWidth' }>, { areaSqm, roadWidthM }: FarInput): Extra {
  const band = required(cap.bands.find((b) => inRange(roadWidthM, b.roadWidthM)), 'purchase road width bands')
  return band.kind === 'none' ? { gfaSqm: 0, cites: [band.cite] } : { gfaSqm: band.ratio.value * areaSqm, cites: [band.ratio.cite] }
}

function capExtra(cap: FarPurchase['cap'], input: FarInput, baseSqm: number, permissibleSqm: number): Extra {
  switch (cap.kind) {
    case 'extraRatio':
      return { gfaSqm: cap.ratio.value * input.areaSqm, cites: [cap.ratio.cite] }
    case 'extraRatioByRoadWidth':
      return roadWidthExtra(cap, input)
    case 'shareOf':
      return { gfaSqm: cap.share.value * (cap.of === 'base' ? baseSqm : permissibleSqm), cites: [cap.share.cite] }
  }
}

const priceCites = (price: FarPurchase['price']): Cite[] => {
  switch (price.kind) {
    case 'perSqm':
      return [price.value.cite]
    case 'shareOfLandRate':
      return [price.share.cite]
    case 'userSupplied':
      return []
  }
}

const onPermissible = ({ cap }: FarPurchase) => cap.kind === 'shareOf' && cap.of === 'permissible'

function purchaseOption(purchase: FarPurchase, input: FarInput, baseSqm: number, permissibleSqm: number): PurchaseOption {
  const extra = capExtra(purchase.cap, input, baseSqm, permissibleSqm)
  const chosenRatio = Math.max(0, input.purchase[purchase.kind] ?? 0)
  return {
    kind: purchase.kind,
    maxExtraGfaSqm: extra.gfaSqm,
    chosenGfaSqm: Math.min(extra.gfaSqm, chosenRatio * input.areaSqm),
    onPermissible: onPermissible(purchase),
    price: purchase.price,
    cites: [...extra.cites, ...priceCites(purchase.price), ...purchase.notes],
  }
}

function purchaseLimits(input: FarInput, base: FarLimits['far']): FarLimits['farPurchase'] {
  const purchases = input.pack.farPurchases ?? []
  const direct = purchases.filter((purchase) => !onPermissible(purchase)).map((purchase) => purchaseOption(purchase, input, base.maxGfaSqm, 0))
  const permissibleSqm = direct.reduce((sum, option) => sum + option.chosenGfaSqm, base.maxGfaSqm)
  const options = purchases.map(
    (purchase) => direct.find((option) => option.kind === purchase.kind) ?? purchaseOption(purchase, input, base.maxGfaSqm, permissibleSqm),
  )
  const extraGfaSqm = options.reduce((sum, option) => sum + option.chosenGfaSqm, 0)
  return { options, extraGfaSqm, cites: options.filter((option) => option.chosenGfaSqm > 0).flatMap((option) => option.cites) }
}

export function farLimits(input: FarInput): FarLimits {
  const far = baseFar(input.pack.far, input)
  return { far, farBonus: bonusLimits(input, far), farPurchase: purchaseLimits(input, far), inLieu: input.inLieu }
}

const sumChosen = (options: readonly PurchaseOption[]) => options.reduce((sum, option) => sum + option.chosenGfaSqm, 0)

export function purchaseUse({ far, farPurchase, inLieu }: FarLimits, farSqm: number): PurchaseUse[] {
  const aboveFreeSqm = Math.max(0, farSqm - far.maxGfaSqm - (inLieu?.gfaSqm ?? 0))
  const direct = farPurchase.options.filter((option) => !option.onPermissible)
  const directSqm = sumChosen(direct)
  const fromDirectSqm = Math.min(aboveFreeSqm, directSqm)
  let restSqm = aboveFreeSqm - fromDirectSqm
  return farPurchase.options.map((option) => {
    if (!option.onPermissible) {
      const usedGfaSqm = directSqm > 0 ? (fromDirectSqm * option.chosenGfaSqm) / directSqm : 0
      return { kind: option.kind, price: option.price, usedGfaSqm }
    }
    const usedGfaSqm = Math.min(restSqm, option.chosenGfaSqm)
    restSqm -= usedGfaSqm
    return { kind: option.kind, price: option.price, usedGfaSqm }
  })
}

export function farCapFor({ far, farBonus, farPurchase, inLieu }: FarLimits, mode: FarMode): FarCap {
  const inLieuSqm = inLieu?.gfaSqm ?? 0
  const standard: FarCap = { mode: 'standard', maxGfaSqm: far.maxGfaSqm + inLieuSqm, cites: [...far.cites, ...(inLieu?.cites ?? [])] }
  switch (mode) {
    case 'standard':
      return standard
    case 'bonus':
      return farBonus.extraGfaSqm > 0 ? { mode, maxGfaSqm: farBonus.maxGfaSqm + inLieuSqm, cites: [...standard.cites, ...farBonus.cites] } : standard
    case 'purchased':
      return farPurchase.extraGfaSqm > 0
        ? { mode, maxGfaSqm: standard.maxGfaSqm + farPurchase.extraGfaSqm, cites: [...standard.cites, ...farPurchase.cites] }
        : standard
  }
}
