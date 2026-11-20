import type { PlotLimits } from '@/plot/plot'
import { enteredCite, type Cite, type RulePack } from '@/rules'
import { SolveError } from './errors'

export type PlanHeight = { readonly limitM: number | null; readonly cites: readonly Cite[] }

function plotSpecificHeight(plotLimits: PlotLimits | undefined, floorToFloorM: number): PlanHeight {
  const caps = [
    ...(plotLimits?.maxHeightM === undefined ? [] : [{ limitM: plotLimits.maxHeightM, cite: enteredCite('maxHeightM') }]),
    ...(plotLimits?.maxStoreys === undefined ? [] : [{ limitM: plotLimits.maxStoreys * floorToFloorM, cite: enteredCite('maxStoreys') }]),
  ]
  if (caps.length === 0) throw new SolveError('plot-limit-missing', ['maxHeightM', 'maxStoreys'])
  return { limitM: Math.min(...caps.map((cap) => cap.limitM)), cites: caps.map((cap) => cap.cite) }
}

export function planHeight(pack: RulePack, plotLimits: PlotLimits | undefined, floorToFloorM: number): PlanHeight {
  const limit = pack.height.planLimit
  switch (limit.kind) {
    case 'none':
      return { limitM: null, cites: [limit.absent.from, limit.absent.to] }
    case 'maxMetres':
      return { limitM: limit.maxM.value, cites: [limit.maxM.cite] }
    case 'maxStoreys':
      return { limitM: limit.maxStoreys.value * floorToFloorM, cites: [limit.maxStoreys.cite] }
    case 'plotSpecific':
      return plotSpecificHeight(plotLimits, floorToFloorM)
  }
}
