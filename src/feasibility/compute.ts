import { designs, type Design } from '@/designs'
import { GeometryError, type GeometryErrorReason } from '@/geometry'
import type { Plot } from '@/plot/plot'
import { REGION } from '@/region/regions'
import { loadPack } from '@/rules'
import { packInterpretations, solve, type FarMode, type Solution } from '@/solve'
import { carvingRules } from './rule-layers'

export const PACK = loadPack(REGION.packId)
export const CARVING = carvingRules(PACK)
const READINGS = packInterpretations(PACK)

export type FailureReason = GeometryErrorReason | 'unknown'

export type Feasibility =
  | { readonly status: 'ready'; readonly solution: Solution; readonly designs: readonly Design[] }
  | { readonly status: 'failed'; readonly reason: FailureReason }

export function feasibility(plot: Plot, farMode: FarMode = 'standard'): Feasibility {
  try {
    const solution = solve(plot, PACK, READINGS, farMode)
    return { status: 'ready', solution, designs: designs(solution) }
  } catch (error) {
    return { status: 'failed', reason: error instanceof GeometryError ? error.reason : 'unknown' }
  }
}
