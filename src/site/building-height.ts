import { DEFAULT_BUILDING_HEIGHT_M, MAX_PLAUSIBLE_HEIGHT_M, METRES_PER_LEVEL } from './assumptions'
import { parseLengthM, parsePositiveNumber } from './length'
import type { OverpassTags } from './overpass-response'
import type { Building } from './schema'

export type BuildingHeight = Pick<Building, 'heightM' | 'heightSource' | 'minHeightM'>

function plausible(heightM: number | undefined): number | undefined {
  return heightM !== undefined && heightM <= MAX_PLAUSIBLE_HEIGHT_M.value ? heightM : undefined
}

function fromLevels(levels: string | undefined): number | undefined {
  const count = parsePositiveNumber(levels)
  return count === undefined ? undefined : plausible(count * METRES_PER_LEVEL.value)
}

function resolveTop(tags: OverpassTags): Omit<BuildingHeight, 'minHeightM'> {
  const height = plausible(parseLengthM(tags.height))
  if (height !== undefined) return { heightM: height, heightSource: 'height' }
  const levelsHeight = fromLevels(tags['building:levels'])
  if (levelsHeight !== undefined) return { heightM: levelsHeight, heightSource: 'levels' }
  return { heightM: DEFAULT_BUILDING_HEIGHT_M.value, heightSource: 'default' }
}

function resolveMinHeight(tags: OverpassTags, heightM: number): number {
  const minHeight = parseLengthM(tags.min_height) ?? fromLevels(tags['building:min_level']) ?? 0
  return minHeight < heightM ? minHeight : 0
}

export function resolveBuildingHeight(tags: OverpassTags): BuildingHeight {
  const top = resolveTop(tags)
  return { ...top, minHeightM: resolveMinHeight(tags, top.heightM) }
}
