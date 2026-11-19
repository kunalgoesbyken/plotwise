import {
  booleanOpDWithPolyTree,
  ClipType,
  EndType,
  FillRule,
  inflatePathsD,
  JoinType,
  PolyTreeD,
  type PathD,
  type PathsD,
  type PolyPathD,
} from 'clipper2-ts'
import type { Vec2 } from '@/geo/projection'
import { polygonArea, signedArea, type Loop, type Polygon } from './polygon'
import { CLIPPER_DECIMALS, MIN_PIECE_SQM } from './tolerance'

const MITER_LIMIT = 2
const SCALE = 10 ** CLIPPER_DECIMALS

const toPath = (loop: Loop): PathD => loop.map(([x, y]) => ({ x, y }))
const toPaths = (polygons: readonly Polygon[]): PathsD => polygons.flatMap((p) => [p.outer, ...p.holes].map(toPath))
const onGrid = (value: number) => Math.round(value * SCALE) / SCALE

function toLoop(node: PolyPathD, counterClockwise: boolean): Vec2[] {
  const loop = (node.poly ?? []).map(({ x, y }): Vec2 => [onGrid(x), onGrid(y)])
  return signedArea(loop) > 0 === counterClockwise ? loop : loop.reverse()
}

const children = (node: PolyPathD): PolyPathD[] => Array.from({ length: node.count }, (_, i) => node.child(i))

function polygonsOf(node: PolyPathD): Polygon[] {
  return children(node).flatMap((outer) => {
    const holes = children(outer)
    const polygon: Polygon = {
      outer: toLoop(outer, true),
      holes: holes.map((hole) => toLoop(hole, false)).filter((hole) => Math.abs(signedArea(hole)) >= MIN_PIECE_SQM),
    }
    const islands = holes.flatMap(polygonsOf)
    return polygonArea(polygon) >= MIN_PIECE_SQM ? [polygon, ...islands] : islands
  })
}

function clip(clipType: ClipType, subject: PathsD, clipPaths: PathsD): Polygon[] {
  const tree = new PolyTreeD()
  booleanOpDWithPolyTree(clipType, subject, clipPaths, tree, FillRule.NonZero, CLIPPER_DECIMALS)
  return polygonsOf(tree)
}

export function difference(subject: readonly Polygon[], cutters: readonly Polygon[]): Polygon[] {
  return clip(ClipType.Difference, toPaths(subject), toPaths(cutters))
}

export function intersection(a: readonly Polygon[], b: readonly Polygon[]): Polygon[] {
  return clip(ClipType.Intersection, toPaths(a), toPaths(b))
}

export function shrink(polygons: readonly Polygon[], distanceM: number): Polygon[] {
  const offset = inflatePathsD(toPaths(polygons), -distanceM, JoinType.Miter, EndType.Polygon, MITER_LIMIT, CLIPPER_DECIMALS)
  return clip(ClipType.Union, offset, [])
}
