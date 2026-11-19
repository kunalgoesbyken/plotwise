import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import type { BufferGeometry } from 'three'
import type { Vec2 } from '@/geo/projection'
import { floorPlates, normalizeRing, polygonArea, tieredEnvelope, totalArea, type Polygon } from '@/geometry'
import { starPolygon } from '@/geometry/arbitraries'
import type { ContextBuilding } from './context'
import {
  buildingsGeometry,
  flatGeometry,
  layerSolids,
  ringEdges,
  roadRibbons,
  solidEdges,
  solidsGeometry,
  type BuildingTones,
} from './meshes'

type Point = [number, number, number]

const square = (x: number, y: number, size: number): Vec2[] => [
  [x, y],
  [x + size, y],
  [x + size, y + size],
  [x, y + size],
]

const L_PLOT = normalizeRing([
  [0, 0],
  [40, 0],
  [40, 20],
  [20, 20],
  [20, 50],
  [0, 50],
])

function vertices(geometry: BufferGeometry, name = 'position'): Point[] {
  const { array } = geometry.getAttribute(name)
  return Array.from({ length: array.length / 3 }, (_, i): Point => [array[3 * i], array[3 * i + 1], array[3 * i + 2]])
}

function triangles(geometry: BufferGeometry): Point[][] {
  const points = vertices(geometry)
  return Array.from({ length: points.length / 3 }, (_, i) => points.slice(3 * i, 3 * i + 3))
}

const cross = ([ax, ay, az]: Point, [bx, by, bz]: Point): Point => [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx]
const dot = ([ax, ay, az]: Point, [bx, by, bz]: Point) => ax * bx + ay * by + az * bz
const minus = ([ax, ay, az]: Point, [bx, by, bz]: Point): Point => [ax - bx, ay - by, az - bz]

function enclosedVolume(geometry: BufferGeometry): number {
  return triangles(geometry).reduce((sum, [a, b, c]) => sum + dot(a, cross(b, c)) / 6, 0)
}

function upwardArea(geometry: BufferGeometry): number {
  return triangles(geometry).reduce((sum, [a, b, c]) => sum + Math.max(0, cross(minus(b, a), minus(c, a))[2]) / 2, 0)
}

function heights(geometry: BufferGeometry): number[] {
  geometry.computeBoundingBox()
  return [geometry.boundingBox!.min.z, geometry.boundingBox!.max.z]
}

function segmentsOf(positions: readonly number[]): [Point, Point][] {
  return Array.from({ length: positions.length / 6 }, (_, i) => {
    const s = positions.slice(6 * i, 6 * i + 6)
    return [
      [s[0], s[1], s[2]],
      [s[3], s[4], s[5]],
    ]
  })
}

const TONES: BuildingTones = { mapped: [0.5, 0.5, 0.5], guessed: [0.75, 0.75, 0.75] }

const building = (polygon: Polygon, baseM: number, topM: number, guessed = false): ContextBuilding => ({
  polygon,
  baseM,
  topM,
  guessed,
})

describe('solidsGeometry', () => {
  it('extrudes a square into twelve outward-facing triangles between its base and top', () => {
    const geometry = solidsGeometry([{ polygon: { outer: square(0, 0, 10), holes: [] }, baseM: 2, topM: 7 }])
    expect(triangles(geometry)).toHaveLength(12)
    geometry.computeBoundingBox()
    expect(geometry.boundingBox!.min.toArray()).toEqual([0, 0, 2])
    expect(geometry.boundingBox!.max.toArray()).toEqual([10, 10, 7])
    expect(enclosedVolume(geometry)).toBeCloseTo(500, 6)
  })

  it('cuts holes through the walls and both caps', () => {
    const polygon = { outer: square(0, 0, 30), holes: [square(10, 10, 10)] }
    const geometry = solidsGeometry([{ polygon, baseM: 0, topM: 4 }])
    expect(triangles(geometry)).toHaveLength(8 * 2 + 8 * 2)
    expect(enclosedVolume(geometry)).toBeCloseTo((900 - 100) * 4, 6)
    expect(upwardArea(geometry)).toBeCloseTo(800, 6)
  })

  it('encloses exactly the footprint area times the height, whichever way the ring turns', () => {
    fc.assert(
      fc.property(starPolygon(20), fc.boolean(), fc.double({ min: 1, max: 80, noNaN: true }), (points, clockwise, heightM) => {
        const outer = clockwise ? [...points].reverse() : points
        const geometry = solidsGeometry([{ polygon: { outer, holes: [] }, baseM: 0, topM: heightM }])
        const area = polygonArea({ outer, holes: [] })
        expect(enclosedVolume(geometry) / (area * heightM)).toBeCloseTo(1, 4)
        expect(upwardArea(geometry) / area).toBeCloseTo(1, 4)
        vertices(geometry, 'normal').forEach((normal) => expect(Math.hypot(...normal)).toBeCloseTo(1, 5))
      }),
      { numRuns: 100 },
    )
  })
})

describe('buildingsGeometry', () => {
  const tall = building({ outer: square(0, 0, 10), holes: [] }, 0, 60)
  const guess = building({ outer: square(20, 0, 10), holes: [] }, 0, 5, true)
  const bridge = building({ outer: square(40, 0, 10), holes: [] }, 6, 9)

  it('merges every building into one geometry with the vertices of each', () => {
    const merged = buildingsGeometry([tall, guess, bridge], TONES)
    const separate = [tall, guess, bridge].map((b) => vertices(buildingsGeometry([b], TONES)).length)
    expect(vertices(merged)).toHaveLength(separate.reduce((a, b) => a + b, 0))
    expect(enclosedVolume(merged)).toBeCloseTo(100 * 60 + 100 * 5 + 100 * 3, 6)
  })

  it('extrudes from the minimum height to the height of each building', () => {
    expect(heights(buildingsGeometry([bridge], TONES))).toEqual([6, 9])
    expect(heights(buildingsGeometry([tall, bridge], TONES))).toEqual([0, 60])
  })

  it('tints buildings with a guessed height lighter than mapped ones', () => {
    const geometry = buildingsGeometry([tall, guess], TONES)
    const points = vertices(geometry)
    const colors = vertices(geometry, 'color')
    points.forEach(([x], i) => expect(colors[i]).toEqual(x >= 20 ? [...TONES.guessed] : [...TONES.mapped]))
  })

  it('returns an empty geometry for no buildings', () => {
    expect(vertices(buildingsGeometry([], TONES))).toHaveLength(0)
  })
})

describe('envelope and floors from the geometry engine', () => {
  const envelope = tieredEnvelope(L_PLOT, [
    { fromM: 0, toM: 12, setbacks: [2, 2, 2, 2, 2, 2] },
    { fromM: 12, toM: 30, setbacks: [6, 4, 4, 4, 4, 4] },
  ])

  it('fills each tier of the allowed envelope as its own stacked solid', () => {
    const solids = layerSolids(envelope)
    const geometry = solidsGeometry(solids)
    const expected = envelope.reduce((sum, tier) => sum + totalArea(tier.polygons) * (tier.topM - tier.baseM), 0)
    expect(enclosedVolume(geometry)).toBeCloseTo(expected, 3)
    expect(heights(geometry)).toEqual([0, 30])
  })

  it('outlines every tier at its base and top so the step-back reads', () => {
    const levels = new Set(segmentsOf(solidEdges(layerSolids(envelope))).flatMap(([a, b]) => [a[2], b[2]]))
    expect([...levels].sort((a, b) => a - b)).toEqual([0, 12, 30])
  })

  it('draws upright edges at the five sharp corners of each tier, not along the arc round the inner corner', () => {
    const solids = layerSolids(envelope)
    const corners = solids.reduce((sum, solid) => sum + solid.polygon.outer.length, 0)
    const uprights = segmentsOf(solidEdges(solids)).filter(([a, b]) => a[2] !== b[2])
    expect(uprights).toHaveLength(10)
    expect(corners).toBeGreaterThan(12)
  })

  it('draws a line at every floor of a design stacked inside the envelope', () => {
    const { floors } = floorPlates(envelope, 3)
    const levels = new Set(segmentsOf(solidEdges(layerSolids(floors))).flatMap(([a, b]) => [a[2], b[2]]))
    expect([...levels].sort((a, b) => a - b)).toEqual(Array.from({ length: floors.length + 1 }, (_, i) => i * 3))
    expect(enclosedVolume(solidsGeometry(layerSolids(floors)))).toBeCloseTo(
      floors.reduce((sum, floor) => sum + totalArea(floor.polygons) * 3, 0),
      3,
    )
  })
})

describe('flat ground geometry', () => {
  it('lays polygons flat at ground level facing up', () => {
    const geometry = flatGeometry([{ outer: [...L_PLOT].reverse(), holes: [] }])
    expect(heights(geometry)).toEqual([0, 0])
    vertices(geometry, 'normal').forEach((normal) => expect(normal).toEqual([0, 0, 1]))
    expect(upwardArea(geometry)).toBeCloseTo(polygonArea({ outer: L_PLOT, holes: [] }), 6)
  })

  it('turns a road centreline into a ribbon as wide as the road with rounded ends', () => {
    const [ribbon] = roadRibbons([{ line: [[0, 0], [100, 0]], widthM: 10 }])
    expect(polygonArea(ribbon)).toBeCloseTo(100 * 10 + Math.PI * 25, 0)
  })

  it('keeps the island inside a ring road open', () => {
    const ring = roadRibbons([{ line: [[0, 0], [60, 0], [60, 60], [0, 60], [0, 0]], widthM: 8 }])
    expect(ring).toHaveLength(1)
    expect(ring[0].holes).toHaveLength(1)
    expect(polygonArea({ outer: ring[0].holes[0], holes: [] })).toBeCloseTo(52 * 52, 0)
  })

  it('outlines only the requested edges of the plot', () => {
    const frontage = segmentsOf(ringEdges(L_PLOT, [0, 3], 0.2))
    expect(frontage).toEqual([
      [[...L_PLOT[0], 0.2], [...L_PLOT[1], 0.2]],
      [[...L_PLOT[3], 0.2], [...L_PLOT[4], 0.2]],
    ])
  })
})
