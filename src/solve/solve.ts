import type { Plot } from '@/plot/plot'
import { siteOf, type Site } from '@/plot/site'
import type { RulePack } from '@/rules'
import { ASSUMPTIONS } from './assumptions'
import { highRiseEnvelope, ordinaryEnvelope, type Envelope } from './envelope'
import type { Interpretations } from './interpretations'
import { farCapFor, limitsFor, type FarCap, type FarMode, type Limits } from './limits'

export type Solution = {
  readonly pack: RulePack
  readonly readings: Interpretations
  readonly plot: Plot
  readonly site: Site
  readonly floorToFloorM: number
  readonly limits: Limits
  readonly farCap: FarCap
  readonly envelopes: readonly Envelope[]
}

export function solve(plot: Plot, pack: RulePack, readings: Interpretations, farMode: FarMode = 'standard'): Solution {
  const site = siteOf(plot)
  const floorToFloorM = ASSUMPTIONS.floorToFloorM[plot.buildingType].value
  const limits = limitsFor({ pack, readings, site, buildingType: plot.buildingType, nearStation: plot.nearStation })
  const input = { pack, readings, site, floorToFloorM }
  const highRisePermitted = limits.highRise.access.some((band) => band.qualifies)
  const envelopes = [ordinaryEnvelope(input), ...(highRisePermitted ? [highRiseEnvelope(input)] : [])]
  return { pack, readings, plot, site, floorToFloorM, limits, farCap: farCapFor(limits, farMode), envelopes }
}
