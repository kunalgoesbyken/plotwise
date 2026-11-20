import { localFrame, type LngLat } from '@/geo/projection'
import type { AreaMap, AreaTier } from '@/solve'

export type Placement = { readonly tier: AreaTier; readonly distanceKm: number; readonly determined: boolean }

const METRES_PER_KM = 1000

export function placementOf(point: LngLat, { centre, radiusKm, fallbackTier }: AreaMap): Placement {
  const [x, y] = localFrame([centre.lng, centre.lat]).toLocal(point)
  const distanceKm = Math.hypot(x, y) / METRES_PER_KM
  if (!Number.isFinite(distanceKm) || distanceKm > radiusKm.coverage) return { tier: fallbackTier, distanceKm, determined: false }
  if (distanceKm <= radiusKm.cbd) return { tier: 'cbd', distanceKm, determined: true }
  if (distanceKm <= radiusKm.cityFringe) return { tier: 'cityFringe', distanceKm, determined: true }
  return { tier: 'suburban', distanceKm, determined: true }
}
