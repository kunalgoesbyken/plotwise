import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import { localFrame, type LngLat, type Vec2 } from '@/geo/projection'
import { siteOf } from './site'
import type { Plot } from './plot'

const frame = localFrame([100.56, 13.74])
const toRing = (points: readonly Vec2[]) => points.map((p): [number, number] => [...frame.toLngLat(p)])

const lShape: Vec2[] = [
  [0, 0],
  [40, 0],
  [40, 20],
  [20, 20],
  [20, 35],
  [0, 35],
]

function plotOf(points: readonly Vec2[], roads: Plot['roads']): Plot {
  return { ring: toRing(points), roads, buildingType: 'condo', nearStation: false }
}

describe('siteOf', () => {
  it('measures the land area and every edge from the outline, in metres', () => {
    const site = siteOf(plotOf(lShape, [{ edge: 0, widthM: 12 }]))
    expect(site.areaSqm).toBeCloseTo(40 * 20 + 20 * 15, 1)
    expect(site.edges.map((e) => e.lengthM)).toEqual([40, 20, 20, 15, 20, 35].map((m) => expect.closeTo(m, 2)))
  })

  it('gives each road edge its width and its frontage length; other edges have no road', () => {
    const site = siteOf(plotOf(lShape, [{ edge: 0, widthM: 12 }, { edge: 5, widthM: 6 }]))
    expect(site.edges.map((e) => e.roadWidthM)).toEqual([12, null, null, null, null, 6])
  })

  it('keeps road edges on the right sides when the outline is drawn clockwise', () => {
    const clockwise = [...lShape].reverse()
    const site = siteOf(plotOf(clockwise, [{ edge: 0, widthM: 9 }]))
    const road = site.edges.findIndex((e) => e.roadWidthM === 9)
    const ends = [site.ring[road], site.ring[(road + 1) % site.ring.length]]
    const inPlotMetres = ends.map((p) => frame.toLocal(site.frame.toLngLat(p)).map(Math.round)).sort((a, b) => a[0] - b[0])
    expect(inPlotMetres).toEqual([
      [0, 35],
      [20, 35],
    ])
  })

  it('merges a straight-through corner and keeps the road that ran along either half', () => {
    const withMidpoint: Vec2[] = [lShape[0], [25, 0], ...lShape.slice(1)]
    const site = siteOf(plotOf(withMidpoint, [{ edge: 1, widthM: 16 }]))
    expect(site.edges).toHaveLength(6)
    expect(site.edges[0]).toEqual({ lengthM: expect.closeTo(40, 2), roadWidthM: 16 })
  })

  it('has one edge per ring corner and every frontage is positive', () => {
    const corners = fc.integer({ min: 3, max: 30 })
    fc.assert(
      fc.property(corners, fc.double({ min: 2, max: 60, noNaN: true }), (n, widthM) => {
        const points = Array.from({ length: n }, (_, i): Vec2 => {
          const angle = (2 * Math.PI * i) / n
          return [50 * Math.cos(angle), 50 * Math.sin(angle)]
        })
        const site = siteOf(plotOf(points, [{ edge: 0, widthM }]))
        expect(site.edges).toHaveLength(site.ring.length)
        expect(site.edges.every((e) => e.lengthM > 0)).toBe(true)
        expect(site.edges.filter((e) => e.roadWidthM !== null)).toHaveLength(1)
      }),
    )
  })

  it('works in the local frame of the first corner', () => {
    const origin: LngLat = toRing(lShape)[0]
    expect(siteOf(plotOf(lShape, [{ edge: 0, widthM: 12 }])).frame.origin).toEqual(origin)
  })
})
