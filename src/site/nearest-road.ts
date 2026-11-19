import { localFrame, type LngLat, type LocalFrame, type Vec2 } from '@/geo/projection'
import { dot, length, segmentDistance, subtract } from '@/geometry'
import { MAX_MEDIAN_WIDTH_M, NEAREST_ROAD_MAX_ANGLE_DEG, NEAREST_ROAD_MAX_GAP_M } from './assumptions'
import type { Road } from './schema'

type Segment = readonly [Vec2, Vec2]
type Edge = { segment: Segment; direction: Vec2; frame: LocalFrame }
type Alongside = { road: Road; distanceM: number; side: number; heading: number }

export type NearestRoad = { road: Road; distanceM: number; widthM: number; carriageways: 1 | 2 }

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

function alongside(road: Road, { segment, direction, frame }: Edge): Alongside | null {
  const [closest] = roadSegments(road, frame)
    .filter((part) => isRoughlyParallel(direction, part) && runsAlongside(segment, direction, part))
    .map((part) => ({ part, distanceM: segmentDistance(segment[0], segment[1], part[0], part[1]) }))
    .sort((a, b) => a.distanceM - b.distanceM)
  if (!closest) return null
  const [start, end] = closest.part
  const middle: Vec2 = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2]
  const normal: Vec2 = [-direction[1], direction[0]]
  return {
    road,
    distanceM: closest.distanceM,
    side: Math.sign(dot(normal, subtract(middle, segment[0]))),
    heading: Math.sign(dot(direction, subtract(end, start))),
  }
}

function kerbGap({ distanceM, road }: Alongside): number {
  return Math.max(0, distanceM - road.widthM / 2)
}

function sameLabel(a: string | undefined, b: string | undefined): boolean {
  return a !== undefined && a === b
}

function sharesName(a: Road, b: Road): boolean {
  return sameLabel(a.name, b.name) || sameLabel(a.nameTh, b.nameTh) || sameLabel(a.ref, b.ref)
}

function medianWidth(near: Alongside, far: Alongside): number {
  return far.distanceM - near.distanceM - near.road.widthM / 2 - far.road.widthM / 2
}

function isOppositeCarriageway(near: Alongside, other: Alongside): boolean {
  return (
    other.road.oneway &&
    other.road !== near.road &&
    sharesName(near.road, other.road) &&
    other.side === near.side &&
    other.heading === -near.heading &&
    other.distanceM > near.distanceM &&
    medianWidth(near, other) <= MAX_MEDIAN_WIDTH_M.value
  )
}

function withOppositeCarriageway(near: Alongside, roads: readonly Alongside[]): NearestRoad {
  const single: NearestRoad = { road: near.road, distanceM: near.distanceM, widthM: near.road.widthM, carriageways: 1 }
  if (!near.road.oneway) return single
  const [far] = roads.filter((other) => isOppositeCarriageway(near, other)).sort((a, b) => a.distanceM - b.distanceM)
  if (!far) return single
  const widthM = far.distanceM - near.distanceM + near.road.widthM / 2 + far.road.widthM / 2
  return { ...single, widthM, carriageways: 2 }
}

export function nearestRoad(segment: readonly [LngLat, LngLat], roads: readonly Road[]): NearestRoad | null {
  const frame = localFrame([(segment[0][0] + segment[1][0]) / 2, (segment[0][1] + segment[1][1]) / 2])
  const local: Segment = [frame.toLocal(segment[0]), frame.toLocal(segment[1])]
  if (length(subtract(local[1], local[0])) === 0) return null
  const edge: Edge = { segment: local, direction: unit(subtract(local[1], local[0])), frame }

  const beside = roads
    .filter((road) => road.grade === 'ground')
    .map((road) => alongside(road, edge))
    .filter((candidate): candidate is Alongside => candidate !== null)
  const [best] = beside
    .filter((candidate) => kerbGap(candidate) <= NEAREST_ROAD_MAX_GAP_M.value)
    .sort((a, b) => kerbGap(a) - kerbGap(b) || a.distanceM - b.distanceM)
  return best ? withOppositeCarriageway(best, beside) : null
}
