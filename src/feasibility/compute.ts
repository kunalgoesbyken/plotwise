import { designs, type Design } from '@/designs'
import { GeometryError, type GeometryErrorReason } from '@/geometry'
import type { Plot, PlotLimitField } from '@/plot/plot'
import type { RulePack } from '@/rules'
import { packInterpretations, solve, SolveError, type FarMode, type Solution, type SolveErrorReason } from '@/solve'

export type Failure =
  | { readonly status: 'failed'; readonly reason: GeometryErrorReason | 'unknown' }
  | { readonly status: 'failed'; readonly reason: SolveErrorReason; readonly fields: readonly PlotLimitField[] }

export type Feasibility = { readonly status: 'ready'; readonly solution: Solution; readonly designs: readonly Design[] } | Failure

export function feasibility(plot: Plot, pack: RulePack, farMode: FarMode = 'standard'): Feasibility {
  try {
    const solution = solve(plot, pack, packInterpretations(pack), farMode)
    return { status: 'ready', solution, designs: designs(solution) }
  } catch (error) {
    if (error instanceof GeometryError) return { status: 'failed', reason: error.reason }
    if (error instanceof SolveError) return { status: 'failed', reason: error.reason, fields: error.fields }
    return { status: 'failed', reason: 'unknown' }
  }
}
