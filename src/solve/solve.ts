import type { Plot } from '@/plot/plot'
import { siteOf, type Site } from '@/plot/site'
import type { RulePack } from '@/rules'
import { ASSUMPTIONS } from './assumptions'
import type { Envelope } from './envelope'
import { SolveError } from './errors'
import { EVERY_PURCHASE, farCapFor, purchaseRatios, STANDARD, type FarCap, type FarChoice } from './far'
import { allowedEnvelopes, type Hold } from './holds'
import type { Interpretations } from './interpretations'
import { limitsFor, type Limits } from './limits'
import { plotLimitFields, withPlotLimits } from './plot-limits'
import { reserveRoadWidening, type Widening } from './reservations'

export type Solution = {
  readonly pack: RulePack
  readonly verification: RulePack['verification']
  readonly readings: Interpretations
  readonly plot: Plot
  readonly site: Site
  readonly widening: Widening | null
  readonly landAreaSqm: number
  readonly farAreaSqm: number
  readonly floorToFloorM: number
  readonly limits: Limits
  readonly farCap: FarCap
  readonly envelopes: readonly Envelope[]
  readonly holds: readonly Hold[]
}

export const coversBuildingType = (pack: RulePack, plot: Plot) => !pack.buildingTypes || pack.buildingTypes.includes(plot.buildingType)

type Ground = Omit<Solution, 'limits' | 'farCap' | 'envelopes' | 'holds'>

function bounded({ pack, readings, plot, site, widening, farAreaSqm, floorToFloorM }: Ground, far: FarChoice) {
  const inLieu = widening && widening.inLieuGfaSqm > 0 ? { gfaSqm: widening.inLieuGfaSqm, cites: widening.inLieuCites } : null
  const limits = limitsFor({
    pack,
    readings,
    site,
    farAreaSqm,
    buildingType: plot.buildingType,
    nearStation: plot.nearStation,
    floorToFloorM,
    plotLimits: plot.limits,
    purchase: purchaseRatios(far),
    inLieu,
  })
  return { limits, farCap: farCapFor(limits, far.mode), ...allowedEnvelopes({ pack, readings, site, floorToFloorM, limits }) }
}

export function solve(plot: Plot, authored: RulePack, readings: Interpretations, far: FarChoice = STANDARD): Solution {
  if (!coversBuildingType(authored, plot)) throw new SolveError('building-type-not-covered', [])
  const pack = withPlotLimits(authored, plot.limits)
  const { site, widening } = reserveRoadWidening(siteOf(plot), pack.reservations ?? [])
  const entersValues = plotLimitFields(pack).length > 0
  const ground: Ground = {
    pack,
    verification: authored.verification === 'verified' && !entersValues ? 'verified' : 'unverified',
    readings,
    plot,
    site,
    widening,
    landAreaSqm: widening?.grossAreaSqm ?? site.areaSqm,
    farAreaSqm: widening?.farOn === 'gross' ? widening.grossAreaSqm : site.areaSqm,
    floorToFloorM: ASSUMPTIONS.floorToFloorM[plot.buildingType].value,
  }
  return { ...ground, ...bounded(ground, far) }
}

export const withEveryPurchase = (solution: Solution): Solution => ({ ...solution, ...bounded(solution, EVERY_PURCHASE) })

export function withoutHighRiseRules(solution: Solution): Solution {
  const limits = { ...solution.limits, highRise: null }
  const pack = { ...solution.pack, buildingClasses: undefined, highRise: undefined }
  return { ...solution, limits, ...allowedEnvelopes({ ...solution, pack, limits }) }
}
