import type { Plot } from '@/plot/plot'
import { siteOf, type Site } from '@/plot/site'
import type { RulePack } from '@/rules'
import { ASSUMPTIONS } from './assumptions'
import { highRiseEnvelope, ordinaryEnvelope, type Envelope } from './envelope'
import { farCapFor, type FarCap, type FarMode } from './far'
import type { Interpretations } from './interpretations'
import { limitsFor, type Limits } from './limits'
import { plotLimitFields, withPlotSetbacks } from './plot-limits'
import { reserveRoadWidening, type Widening } from './reservations'

export type Solution = {
  readonly pack: RulePack
  readonly verification: RulePack['verification']
  readonly readings: Interpretations
  readonly plot: Plot
  readonly site: Site
  readonly widening: Widening | null
  readonly floorToFloorM: number
  readonly limits: Limits
  readonly farCap: FarCap
  readonly envelopes: readonly Envelope[]
}

export function solve(plot: Plot, authored: RulePack, readings: Interpretations, farMode: FarMode = 'standard'): Solution {
  const pack = withPlotSetbacks(authored, plot.limits)
  const { site, widening } = reserveRoadWidening(siteOf(plot), pack.reservations ?? [])
  const floorToFloorM = ASSUMPTIONS.floorToFloorM[plot.buildingType].value
  const { buildingType, nearStation } = plot
  const limits = limitsFor({ pack, readings, site, buildingType, nearStation, floorToFloorM, plotLimits: plot.limits })
  const input = { pack, readings, site, floorToFloorM, planLimitM: limits.height.planLimitM }
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
    floorToFloorM,
    limits,
    farCap: farCapFor(limits, farMode),
    envelopes,
  }
}
