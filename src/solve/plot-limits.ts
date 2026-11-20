import type { PlotLimitField, PlotLimits } from '@/plot/plot'
import { enteredBoundarySetback, enteredOpenSpace, enteredParking, enteredRoadSetback, type RulePack } from '@/rules'

export function plotLimitFields({ far, height, coverage, plotSetbacks, plotOpenSpace, plotParking }: RulePack): PlotLimitField[] {
  return [
    ...(far.kind === 'plotSpecific' ? (['maxGfaSqm', 'maxFar'] as const) : []),
    ...(height.planLimit.kind === 'plotSpecific' ? (['maxHeightM', 'maxStoreys'] as const) : []),
    ...(coverage?.kind === 'plotSpecific' ? (['maxCoverageShare'] as const) : []),
    ...(plotSetbacks?.edges === 'roadAndBoundary' ? (['roadSetbackM'] as const) : []),
    ...(plotSetbacks ? (['boundarySetbackM'] as const) : []),
    ...(plotOpenSpace ? (['minOpenSpaceShare'] as const) : []),
    ...(plotParking ? (['parkingSqmPerSpace'] as const) : []),
  ]
}

const given = <T>(value: number | undefined, build: (value: number) => T): T[] => (value === undefined ? [] : [build(value)])

export function withPlotLimits(pack: RulePack, plotLimits: PlotLimits | undefined): RulePack {
  if (!plotLimits) return pack
  const { roadSetbackM, boundarySetbackM, minOpenSpaceShare, parkingSqmPerSpace } = plotLimits
  const edges = pack.plotSetbacks?.edges
  return {
    ...pack,
    roadSetbacks: [...pack.roadSetbacks, ...(edges === 'roadAndBoundary' ? given(roadSetbackM, (m) => enteredRoadSetback(m, 'roadSetbackM')) : [])],
    boundarySetbacks: [...pack.boundarySetbacks, ...(edges ? given(boundarySetbackM, (m) => enteredBoundarySetback(m, 'boundarySetbackM')) : [])],
    openSpaceMinimums: [
      ...pack.openSpaceMinimums,
      ...(pack.plotOpenSpace ? given(minOpenSpaceShare, (share) => enteredOpenSpace(share, 'minOpenSpaceShare')).flat() : []),
    ],
    parking: [...pack.parking, ...(pack.plotParking ? given(parkingSqmPerSpace, (sqm) => enteredParking(sqm, 'parkingSqmPerSpace')) : [])],
  }
}
