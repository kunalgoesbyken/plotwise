import {
  LANE_WIDTH_M,
  MAX_PLAUSIBLE_LANES,
  MAX_PLAUSIBLE_ROAD_WIDTH_M,
  ROAD_WIDTH_BY_CLASS_M,
  type HighwayClass,
} from './assumptions'
import { parseLengthM, parsePositiveNumber } from './length'
import type { OverpassTags } from './overpass-response'
import type { Road } from './schema'

type RoadWidth = Pick<Road, 'widthM' | 'widthSource'>

const NOT_STRUCTURES = ['no', 'building_passage']

function withinLimit(value: number | undefined, limit: number): number | undefined {
  return value !== undefined && value <= limit ? value : undefined
}

export function resolveRoadWidth(tags: OverpassTags, highway: HighwayClass): RoadWidth {
  const width = withinLimit(parseLengthM(tags.width), MAX_PLAUSIBLE_ROAD_WIDTH_M.value)
  if (width !== undefined) return { widthM: width, widthSource: 'width' }
  const lanes = withinLimit(parsePositiveNumber(tags.lanes), MAX_PLAUSIBLE_LANES.value)
  if (lanes !== undefined) return { widthM: lanes * LANE_WIDTH_M.value, widthSource: 'lanes' }
  return { widthM: ROAD_WIDTH_BY_CLASS_M.value[highway], widthSource: 'class' }
}

function isStructure(value: string | undefined): boolean {
  return value !== undefined && !NOT_STRUCTURES.includes(value)
}

export function resolveRoadGrade(tags: OverpassTags): Road['grade'] {
  const layer = Number(tags.layer)
  if (isStructure(tags.tunnel) || layer < 0) return 'tunnel'
  if (isStructure(tags.bridge) || layer > 0) return 'elevated'
  return 'ground'
}
