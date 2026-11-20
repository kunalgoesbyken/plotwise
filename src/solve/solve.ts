import type { Plot } from '@/plot/plot'
import { siteOf, type Site } from '@/plot/site'
import type { RulePack } from '@/rules'
import { ASSUMPTIONS } from './assumptions'
import { highRiseEnvelope, ordinaryEnvelope, type Envelope } from './envelope'
import { SolveError } from './errors'
import { farCapFor, purchaseRatios, STANDARD, type FarCap, type FarChoice } from './far'
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
}

export const coversBuildingType = (pack: RulePack, plot: Plot) => !pack.buildingTypes || pack.buildingTypes.includes(plot.buildingType)

export function solve(plot: Plot, authored: RulePack, readings: Interpretations, far: FarChoice = STANDARD): Solution {
  if (!coversBuildingType(authored, plot)) throw new SolveError('building-type-not-covered', [])
  const pack = withPlotLimits(authored, plot.limits)
  const { site, widening } = reserveRoadWidening(siteOf(plot), pack.reservations ?? [])
  const floorToFloorM = ASSUMPTIONS.floorToFloorM[plot.buildingType].value
  const { buildingType, nearStation } = plot
  const farAreaSqm = widening?.farOn === 'gross' ? widening.grossAreaSqm : site.areaSqm
  const inLieu = widening && widening.inLieuGfaSqm > 0 ? { gfaSqm: widening.inLieuGfaSqm, cites: widening.inLieuCites } : null
  const limits = limitsFor({
    pack,
    readings,
    site,
    farAreaSqm,
    buildingType,
    nearStation,
    floorToFloorM,
    plotLimits: plot.limits,
    purchase: purchaseRatios(far),
    inLieu,
  })
  const input = { pack, readings, site, floorToFloorM, planLimitM: limits.height.planLimitM, sideRear: limits.sideRear }
  const highRisePermitted = limits.highRise?.access.some((band) => band.qualifies) ?? false
  const envelopes = [ordinaryEnvelope(input), ...(highRisePermitted ? [highRiseEnvelope(input)] : [])]
  const entersValues = plotLimitFields(pack).length > 0
  return {
    pack,
    verification: authored.verification === 'verified' && !entersValues ? 'verified' : 'unverified',
    readings,
    plot,
    site,
    widening,
    landAreaSqm: widening?.grossAreaSqm ?? site.areaSqm,
    farAreaSqm,
    floorToFloorM,
    limits,
    farCap: farCapFor(limits, far.mode),
    envelopes,
  }
}
