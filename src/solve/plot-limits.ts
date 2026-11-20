import type { PlotLimitField, PlotLimits } from '@/plot/plot'
import { enteredBoundarySetback, enteredRoadSetback, type RulePack } from '@/rules'

export function plotLimitFields({ far, height, coverage, plotSetbacks }: RulePack): PlotLimitField[] {
  return [
    ...(far.kind === 'plotSpecific' ? (['maxGfaSqm'] as const) : []),
    ...(height.planLimit.kind === 'plotSpecific' ? (['maxHeightM', 'maxStoreys'] as const) : []),
    ...(coverage?.kind === 'plotSpecific' ? (['maxCoverageShare'] as const) : []),
    ...(plotSetbacks ? (['roadSetbackM', 'boundarySetbackM'] as const) : []),
  ]
}

export function withPlotSetbacks(pack: RulePack, plotLimits: PlotLimits | undefined): RulePack {
  if (!pack.plotSetbacks || !plotLimits) return pack
  const { roadSetbackM, boundarySetbackM } = plotLimits
  return {
    ...pack,
    roadSetbacks: [...pack.roadSetbacks, ...(roadSetbackM === undefined ? [] : [enteredRoadSetback(roadSetbackM, 'roadSetbackM')])],
    boundarySetbacks: [
      ...pack.boundarySetbacks,
      ...(boundarySetbackM === undefined ? [] : [enteredBoundarySetback(boundarySetbackM, 'boundarySetbackM')]),
    ],
  }
}
