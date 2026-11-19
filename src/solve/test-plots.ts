import { localFrame, type Vec2 } from '@/geo/projection'
import type { BuildingType, Plot, Road } from '@/plot/plot'

const frame = localFrame([100.5636, 13.7466])

export const rectangle = (widthM: number, depthM: number): Vec2[] => [
  [0, 0],
  [widthM, 0],
  [widthM, depthM],
  [0, depthM],
]

export function plotFromMetres(
  points: readonly Vec2[],
  roads: readonly Road[],
  buildingType: BuildingType = 'condo',
  nearStation = false,
): Plot {
  return { ring: points.map((p): [number, number] => [...frame.toLngLat(p)]), roads: [...roads], buildingType, nearStation }
}
