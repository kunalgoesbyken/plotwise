import { areaPathsD, FillRule, intersectD, type PathsD } from 'clipper2-ts'
import { localFrame, type LngLat, type LocalFrame, type Vec2 } from '@/geo/projection'
import { polygonArea, type Loop, type Polygon } from '@/geometry'
import type { Site } from '@/site/schema'
import { REDEVELOPED_SHARE } from './assumptions'
import { extentOf, extentsMeet } from './extent'

export type ContextBuilding = {
  readonly polygon: Polygon
  readonly baseM: number
  readonly topM: number
  readonly guessed: boolean
}

export type ContextRoad = { readonly line: readonly Vec2[]; readonly widthM: number }

export type SiteContext = {
  readonly frame: LocalFrame
  readonly buildings: readonly ContextBuilding[]
  readonly roads: readonly ContextRoad[]
}

export function siteContext(site: Site): SiteContext {
  const [minLng, minLat, maxLng, maxLat] = site.bbox
  const frame = localFrame([(minLng + maxLng) / 2, (minLat + maxLat) / 2])
  const project = (points: readonly LngLat[]) => points.map(frame.toLocal)
  return {
    frame,
    buildings: site.buildings.map((building) => ({
      polygon: { outer: project(building.outer), holes: building.holes.map(project) },
      baseM: building.minHeightM,
      topM: building.heightM,
      guessed: building.heightSource === 'default',
    })),
    roads: site.roads.filter((road) => road.grade !== 'tunnel').map((road) => ({ line: project(road.line), widthM: road.widthM })),
  }
}

const toPath = (loop: Loop) => loop.map(([x, y]) => ({ x, y }))

function shareInside({ polygon }: ContextBuilding, plot: PathsD): number {
  const footprint = [polygon.outer, ...polygon.holes].map(toPath)
  return areaPathsD(intersectD(footprint, plot, FillRule.EvenOdd)) / polygonArea(polygon)
}

export function standingBuildings(buildings: readonly ContextBuilding[], plot: Loop): ContextBuilding[] {
  const plotExtent = extentOf(plot)
  const plotPath = [toPath(plot)]
  return buildings.filter(
    (building) =>
      !extentsMeet(extentOf(building.polygon.outer), plotExtent) || shareInside(building, plotPath) < REDEVELOPED_SHARE.value,
  )
}
