import { localFrame, type LngLat, type LocalFrame } from '@/geo/projection'
import { intersection, polygonArea, signedArea, totalArea, type Polygon } from '@/geometry'
import type { ZoneFeature } from './arcgis'

export type ZoneShare = { readonly code: string | null; readonly share: number }

function ringSign(ring: readonly LngLat[], frame: LocalFrame): { loop: Polygon; sign: 1 | -1 } {
  const loop = ring.map(frame.toLocal)
  return { loop: { outer: loop, holes: [] }, sign: signedArea(loop) < 0 ? 1 : -1 }
}

function overlapSqm(plot: Polygon, feature: ZoneFeature, frame: LocalFrame): number {
  return feature.rings.reduce((sum, ring) => {
    const { loop, sign } = ringSign(ring, frame)
    return sum + sign * totalArea(intersection([plot], [loop]))
  }, 0)
}

export function zoneShares(plotRing: readonly LngLat[], features: readonly ZoneFeature[]): ZoneShare[] {
  const frame = localFrame(plotRing[0])
  const plot: Polygon = { outer: plotRing.map(frame.toLocal), holes: [] }
  const plotSqm = polygonArea(plot)
  const sqmByCode = new Map<string, number>()
  for (const feature of features) sqmByCode.set(feature.code, (sqmByCode.get(feature.code) ?? 0) + overlapSqm(plot, feature, frame))
  return [...sqmByCode].map(([code, sqm]) => ({ code, share: Math.min(1, Math.max(0, sqm / plotSqm)) }))
}
