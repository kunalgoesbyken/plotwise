import { FillRule, areaPathsD, intersectD, unionD, type PathsD } from 'clipper2-ts'
import { localFrame, type LocalFrame } from '@/geo/projection'
import { OUTLINE_COVERAGE_RATIO } from './assumptions'
import type { Bbox } from './bbox'
import type { Building } from './schema'

function extentOf(building: Building): Bbox {
  const lngs = building.outer.map(([lng]) => lng)
  const lats = building.outer.map(([, lat]) => lat)
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)]
}

function overlaps([aMinLng, aMinLat, aMaxLng, aMaxLat]: Bbox, [bMinLng, bMinLat, bMaxLng, bMaxLat]: Bbox): boolean {
  return aMinLng <= bMaxLng && bMinLng <= aMaxLng && aMinLat <= bMaxLat && bMinLat <= aMaxLat
}

function toPaths(building: Building, frame: LocalFrame): PathsD {
  return [building.outer, ...building.holes].map((ring) =>
    ring.map((point) => {
      const [x, y] = frame.toLocal(point)
      return { x, y }
    }),
  )
}

function isCovered(outline: Building, parts: Building[], frame: LocalFrame): boolean {
  const outlinePaths = toPaths(outline, frame)
  const partPaths = parts.flatMap((part) => toPaths(part, frame))
  const covered = intersectD(outlinePaths, unionD(partPaths, FillRule.NonZero), FillRule.NonZero)
  return areaPathsD(covered) / areaPathsD(outlinePaths) >= OUTLINE_COVERAGE_RATIO.value
}

export function dropCoveredOutlines(outlines: Building[], parts: Building[]): Building[] {
  if (outlines.length === 0 || parts.length === 0) return outlines
  const frame = localFrame(outlines[0].outer[0])
  const partExtents = parts.map((part) => ({ part, extent: extentOf(part) }))
  return outlines.filter((outline) => {
    const extent = extentOf(outline)
    const candidates = partExtents.filter((entry) => overlaps(extent, entry.extent)).map((entry) => entry.part)
    return candidates.length === 0 || !isCovered(outline, candidates, frame)
  })
}
