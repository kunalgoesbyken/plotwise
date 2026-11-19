import { EndType, inflatePathsD, JoinType } from 'clipper2-ts'
import { BufferAttribute, BufferGeometry, ShapeUtils, Vector2 } from 'three'
import type { Vec2 } from '@/geo/projection'
import { signedArea, type Loop, type Polygon } from '@/geometry'
import type { ContextBuilding, ContextRoad } from './context'

export type Solid = { readonly polygon: Polygon; readonly baseM: number; readonly topM: number }
export type Layer = { readonly baseM: number; readonly topM: number; readonly polygons: readonly Polygon[] }
export type Rgb = readonly [r: number, g: number, b: number]
export type BuildingTones = { readonly mapped: Rgb; readonly guessed: Rgb }

type Normal = readonly [x: number, y: number, z: number]
type Mesh = { readonly positions: number[]; readonly normals: number[] }

const CORNER_TURN_RAD = Math.PI / 9

const newMesh = (): Mesh => ({ positions: [], normals: [] })

const oriented = (loop: Loop, counterClockwise: boolean): Loop =>
  signedArea(loop) > 0 === counterClockwise ? loop : [...loop].reverse()

const following = <T>(items: readonly T[], i: number): T => items[(i + 1) % items.length]
const preceding = <T>(items: readonly T[], i: number): T => items[(i + items.length - 1) % items.length]

function pushVertex(mesh: Mesh, [x, y]: Vec2, z: number, normal: Normal) {
  mesh.positions.push(x, y, z)
  mesh.normals.push(...normal)
}

function pushWalls(mesh: Mesh, loop: Loop, baseM: number, topM: number) {
  loop.forEach((a, i) => {
    const b = following(loop, i)
    const length = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (length === 0) return
    const normal: Normal = [(b[1] - a[1]) / length, (a[0] - b[0]) / length, 0]
    const corners: [Vec2, number][] = [[a, baseM], [b, baseM], [b, topM], [a, baseM], [b, topM], [a, topM]]
    for (const [point, z] of corners) pushVertex(mesh, point, z, normal)
  })
}

const toVector = ([x, y]: Vec2) => new Vector2(x, y)

function pushCap(mesh: Mesh, { outer, holes }: Polygon, z: number, facingUp: boolean) {
  const points = [outer, ...holes].flat()
  const normal: Normal = [0, 0, facingUp ? 1 : -1]
  for (const [i, j, k] of ShapeUtils.triangulateShape(outer.map(toVector), holes.map((hole) => hole.map(toVector)))) {
    const counterClockwise = signedArea([points[i], points[j], points[k]]) > 0
    const triangle = counterClockwise === facingUp ? [i, j, k] : [i, k, j]
    for (const index of triangle) pushVertex(mesh, points[index], z, normal)
  }
}

function pushSolid(mesh: Mesh, { polygon, baseM, topM }: Solid) {
  pushWalls(mesh, oriented(polygon.outer, true), baseM, topM)
  for (const hole of polygon.holes) pushWalls(mesh, oriented(hole, false), baseM, topM)
  pushCap(mesh, polygon, topM, true)
  pushCap(mesh, polygon, baseM, false)
}

function toGeometry({ positions, normals }: Mesh): BufferGeometry {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3))
  return geometry
}

export function layerSolids(layers: readonly Layer[]): Solid[] {
  return layers.flatMap(({ baseM, topM, polygons }) => polygons.map((polygon) => ({ polygon, baseM, topM })))
}

export function solidsGeometry(solids: readonly Solid[]): BufferGeometry {
  const mesh = newMesh()
  for (const solid of solids) pushSolid(mesh, solid)
  return toGeometry(mesh)
}

export function buildingsGeometry(buildings: readonly ContextBuilding[], tones: BuildingTones): BufferGeometry {
  const mesh = newMesh()
  const colors: number[] = []
  for (const building of buildings) {
    const start = mesh.positions.length
    pushSolid(mesh, building)
    const tone = building.guessed ? tones.guessed : tones.mapped
    for (let i = start; i < mesh.positions.length; i += 3) colors.push(...tone)
  }
  const geometry = toGeometry(mesh)
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3))
  return geometry
}

export function flatGeometry(polygons: readonly Polygon[]): BufferGeometry {
  const mesh = newMesh()
  for (const polygon of polygons) pushCap(mesh, polygon, 0, true)
  return toGeometry(mesh)
}

const toLoop = (path: readonly { x: number; y: number }[]): Vec2[] => path.map(({ x, y }) => [x, y])

function ribbon({ line, widthM }: ContextRoad): Polygon[] {
  const loops = inflatePathsD([line.map(([x, y]) => ({ x, y }))], widthM / 2, JoinType.Round, EndType.Round).map(toLoop)
  const outer = loops.find((loop) => signedArea(loop) > 0)
  return outer ? [{ outer, holes: loops.filter((loop) => signedArea(loop) < 0) }] : []
}

export function roadRibbons(roads: readonly ContextRoad[]): Polygon[] {
  return roads.flatMap(ribbon)
}

function isCorner(before: Vec2, vertex: Vec2, after: Vec2): boolean {
  const [ax, ay] = [vertex[0] - before[0], vertex[1] - before[1]]
  const [bx, by] = [after[0] - vertex[0], after[1] - vertex[1]]
  return Math.abs(Math.atan2(ax * by - ay * bx, ax * bx + ay * by)) > CORNER_TURN_RAD
}

const segment = (a: Vec2, b: Vec2, z: number) => [a[0], a[1], z, b[0], b[1], z]

export function ringEdges(ring: Loop, edges: readonly number[], z: number): number[] {
  return edges.flatMap((i) => segment(ring[i], following(ring, i), z))
}

function loopEdges(loop: Loop, baseM: number, topM: number): number[] {
  return loop.flatMap((vertex, i) => {
    const rings = [...segment(vertex, following(loop, i), baseM), ...segment(vertex, following(loop, i), topM)]
    const upright = isCorner(preceding(loop, i), vertex, following(loop, i)) ? [vertex[0], vertex[1], baseM, vertex[0], vertex[1], topM] : []
    return [...rings, ...upright]
  })
}

export function solidEdges(solids: readonly Solid[]): number[] {
  return solids.flatMap(({ polygon, baseM, topM }) => [polygon.outer, ...polygon.holes].flatMap((loop) => loopEdges(loop, baseM, topM)))
}
