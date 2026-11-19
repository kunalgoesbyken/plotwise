import { designs, type Design } from '@/designs'
import { GeometryError, type GeometryErrorReason } from '@/geometry'
import type { Plot } from '@/plot/plot'
import { loadPack } from '@/rules'
import { packInterpretations, solve, type Solution } from '@/solve'
import { carvingRules } from './rule-layers'

export const PACK = loadPack('bkk-y9')
export const CARVING = carvingRules(PACK)
const READINGS = packInterpretations(PACK)

export type FailureReason = GeometryErrorReason | 'unknown'

export type Feasibility =
  | { readonly status: 'ready'; readonly solution: Solution; readonly designs: readonly Design[] }
  | { readonly status: 'failed'; readonly reason: FailureReason }

export function feasibility(plot: Plot): Feasibility {
  try {
    const solution = solve(plot, PACK, READINGS)
    return { status: 'ready', solution, designs: designs(solution) }
  } catch (error) {
    return { status: 'failed', reason: error instanceof GeometryError ? error.reason : 'unknown' }
  }
}
