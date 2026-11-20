import type { PlotLimitField } from '@/plot/plot'

export type SolveErrorReason = 'plot-limit-missing'

export class SolveError extends Error {
  readonly reason: SolveErrorReason
  readonly fields: readonly PlotLimitField[]

  constructor(reason: SolveErrorReason, fields: readonly PlotLimitField[]) {
    super(`the plot must give ${fields.join(' or ')}`)
    this.name = 'SolveError'
    this.reason = reason
    this.fields = fields
  }
}
