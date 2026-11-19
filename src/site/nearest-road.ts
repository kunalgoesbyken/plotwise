import { localFrame, type LngLat, type LocalFrame, type Vec2 } from '@/geo/projection'
import { dot, length, segmentDistance, subtract } from '@/geometry'
import { NEAREST_ROAD_MAX_ANGLE_DEG, NEAREST_ROAD_MAX_GAP_M } from './assumptions'
import type { Road } from './schema'

type Segment = readonly [Vec2, Vec2]

export type NearestRoad = { road: Road; distanceM: number; widthM: number }

const MIN_COS_ANGLE = Math.cos((NEAREST_ROAD_MAX_ANGLE_DEG.value * Math.PI) / 180)

function unit(vector: Vec2): Vec2 {
  const size = length(vector)
  return [vector[0] / size, vector[1] / size]
}

function isRoughlyParallel(edgeDirection: Vec2, [start, end]: Segment): boolean {
  const direction = subtract(end, start)
  const size = length(direction)
  return size > 0 && Math.abs(dot(edgeDirection, direction)) / size >= MIN_COS_ANGLE
}

function runsAlongside(edge: Segment, edgeDirection: Vec2, [start, end]: Segment): boolean {
  const edgeLength = length(subtract(edge[1], edge[0]))
  const from = dot(subtract(start, edge[0]), edgeDirection)
  const to = dot(subtract(end, edge[0]), edgeDirection)
  return Math.max(from, to) > 0 && Math.min(from, to) < edgeLength
}

function roadSegments(road: Road, frame: LocalFrame): Segment[] {
  const points = road.line.map((point) => frame.toLocal(point))
  return points.slice(1).map((end, index): Segment => [points[index], end])
}

function distanceAlongside(road: Road, edge: Segment, edgeDirection: Vec2, frame: LocalFrame): number {
  const distances = roadSegments(road, frame)
    .filter((segment) => isRoughlyParallel(edgeDirection, segment) && runsAlongside(edge, edgeDirection, segment))
    .map(([start, end]) => segmentDistance(edge[0], edge[1], start, end))
  return Math.min(...distances)
}

function kerbGap(distanceM: number, road: Road): number {
  return Math.max(0, distanceM - road.widthM / 2)
}

export function nearestRoad(segment: readonly [LngLat, LngLat], roads: readonly Road[]): NearestRoad | null {
  const frame = localFrame([(segment[0][0] + segment[1][0]) / 2, (segment[0][1] + segment[1][1]) / 2])
  const edge: Segment = [frame.toLocal(segment[0]), frame.toLocal(segment[1])]
  if (length(subtract(edge[1], edge[0])) === 0) return null
  const edgeDirection = unit(subtract(edge[1], edge[0]))

  const candidates = roads
    .filter((road) => road.grade === 'ground')
    .map((road) => ({ road, distanceM: distanceAlongside(road, edge, edgeDirection, frame) }))
    .filter(({ road, distanceM }) => kerbGap(distanceM, road) <= NEAREST_ROAD_MAX_GAP_M.value)
    .sort((a, b) => kerbGap(a.distanceM, a.road) - kerbGap(b.distanceM, b.road) || a.distanceM - b.distanceM)

  const best = candidates[0]
  return best ? { road: best.road, distanceM: best.distanceM, widthM: best.road.widthM } : null
}
