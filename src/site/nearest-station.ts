import { localFrame, type LngLat, type LocalFrame, type Vec2 } from '@/geo/projection'
import { contains, segmentDistance } from '@/geometry'
import { STATION_PLATFORM_RADIUS_M } from './assumptions'
import type { Station, StationGeometry } from './schema'

type Segment = readonly [Vec2, Vec2]
type Shape = { points: readonly Vec2[]; closed: boolean }
type Located = { station: Station; shape: Shape }
type Names = Pick<Station, 'name' | 'nameTh'>

export type NearestStation = Names & { distanceM: number; measuredFrom: Station['kind'] }

function shapeOf(geometry: StationGeometry, frame: LocalFrame): Shape {
  switch (geometry.type) {
    case 'point':
      return { points: [frame.toLocal(geometry.at)], closed: false }
    case 'line':
      return { points: geometry.line.map(frame.toLocal), closed: false }
    case 'area':
      return { points: geometry.ring.map(frame.toLocal), closed: true }
  }
}

function segmentsOf({ points, closed }: Shape): Segment[] {
  if (points.length === 1) return [[points[0], points[0]]]
  const open = points.slice(1).map((end, index): Segment => [points[index], end])
  return closed ? [...open, [points[points.length - 1], points[0]]] : open
}

function overlaps(outer: Shape, inner: Shape): boolean {
  return outer.closed && inner.points.some((point) => contains(outer.points, point))
}

function shapeDistance(a: Shape, b: Shape): number {
  if (overlaps(a, b) || overlaps(b, a)) return 0
  const others = segmentsOf(b)
  return Math.min(...segmentsOf(a).flatMap(([p, q]) => others.map(([r, s]) => segmentDistance(p, q, r, s))))
}

function namesOf({ name, nameTh }: Station): Names {
  return { ...(name && { name }), ...(nameTh && { nameTh }) }
}

function nodesServing(platform: Located, nodes: readonly Located[]): Located[] {
  return nodes
    .map((node) => ({ node, distanceM: shapeDistance(node.shape, platform.shape) }))
    .filter(({ distanceM }) => distanceM <= STATION_PLATFORM_RADIUS_M.value)
    .sort((a, b) => a.distanceM - b.distanceM)
    .map(({ node }) => node)
}

function platformNames(platform: Located, nodes: readonly Located[]): Names {
  const { name, nameTh } = platform.station
  if (name || nameTh) return namesOf(platform.station)
  const [station] = nodesServing(platform, nodes)
  return station ? namesOf(station.station) : {}
}

export function nearestStation(ring: readonly LngLat[], stations: readonly Station[]): NearestStation | null {
  const frame = localFrame(ring[0])
  const plot: Shape = { points: ring.map(frame.toLocal), closed: true }
  const located = stations.map((station): Located => ({ station, shape: shapeOf(station.geometry, frame) }))
  const platforms = located.filter(({ station }) => station.kind === 'platform')
  const nodes = located.filter(({ station }) => station.kind === 'station')
  const served = new Set(platforms.flatMap((platform) => nodesServing(platform, nodes)))
  const candidates = [...platforms, ...nodes.filter((node) => !served.has(node))]
  if (candidates.length === 0) return null

  const nearest = candidates
    .map((candidate) => ({ candidate, distanceM: shapeDistance(plot, candidate.shape) }))
    .reduce((best, next) => (next.distanceM < best.distanceM ? next : best))
  const { station } = nearest.candidate
  const names = station.kind === 'platform' ? platformNames(nearest.candidate, nodes) : namesOf(station)
  return { ...names, distanceM: nearest.distanceM, measuredFrom: station.kind }
}
