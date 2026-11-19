import { intersection } from './clip'
import { GeometryError } from './errors'
import type { Polygon, Ring } from './polygon'
import { setbackEnvelope } from './setback'
import { LENGTH_TOLERANCE_M } from './tolerance'

export type Tier = { readonly fromM: number; readonly toM: number; readonly setbacks: readonly number[] }
export type Prism = { readonly baseM: number; readonly topM: number; readonly polygons: readonly Polygon[] }

function assertStacked(tiers: readonly Tier[]): void {
  tiers.forEach((tier, i) => {
    if (!(Number.isFinite(tier.fromM) && Number.isFinite(tier.toM) && tier.fromM < tier.toM)) {
      throw new GeometryError('invalid-tiers', `tier ${i} must have a finite height range with fromM below toM`)
    }
    if (i > 0 && Math.abs(tier.fromM - tiers[i - 1].toM) > LENGTH_TOLERANCE_M) {
      throw new GeometryError('invalid-tiers', `tier ${i} must start where tier ${i - 1} ends`)
    }
  })
}

export function tieredEnvelope(plot: Ring, tiers: readonly Tier[]): Prism[] {
  assertStacked(tiers)
  const prisms: Prism[] = []
  for (const tier of tiers) {
    const below = prisms.at(-1)
    const own = setbackEnvelope(plot, tier.setbacks)
    const polygons = below ? intersection(own, below.polygons) : own
    if (polygons.length === 0) break
    prisms.push({ baseM: below?.topM ?? tier.fromM, topM: tier.toM, polygons })
  }
  return prisms
}
