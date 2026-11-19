import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import { localFrame, type Vec2 } from '@/geo/projection'
import { polygonArea } from '@/geometry'
import fixture from '@/site/__fixtures__/ratchadaphisek.overpass.json'
import { OSM_ATTRIBUTION } from '@/site/assumptions'
import { OverpassResponseSchema } from '@/site/overpass-response'
import { parseOverpass } from '@/site/parse'
import type { Site } from '@/site/schema'
import { CONTEXT_MARGIN_M } from './assumptions'
import { contextBbox, siteContext, standingBuildings, type ContextBuilding } from './context'
import { extentOf, extentsMeet } from './extent'

const recorded = parseOverpass(OverpassResponseSchema.parse(fixture))
const lngs = recorded.buildings.flatMap((b) => b.outer.map(([lng]) => lng))
const lats = recorded.buildings.flatMap((b) => b.outer.map(([, lat]) => lat))
const site: Site = {
  bbox: [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)],
  ...recorded,
  attribution: OSM_ATTRIBUTION,
}

const rectangle = (x: number, y: number, w: number, h: number): Vec2[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
]

const block = (x: number, y: number, w: number, h: number): ContextBuilding => ({
  polygon: { outer: rectangle(x, y, w, h), holes: [] },
  baseM: 0,
  topM: 20,
  guessed: false,
})

describe('contextBbox', () => {
  it('covers the plot with the context margin on every side', () => {
    const frame = localFrame([100.53, 13.724])
    const ring = [frame.toLngLat([0, 0]), frame.toLngLat([40, 0]), frame.toLngLat([40, 30])]
    const [minLng, minLat, maxLng, maxLat] = contextBbox(ring)
    const [west, south] = frame.toLocal([minLng, minLat])
    const [east, north] = frame.toLocal([maxLng, maxLat])
    const margin = CONTEXT_MARGIN_M.value
    expect([west, south, east, north].map((v) => Math.round(v * 1000) / 1000)).toEqual([-margin, -margin, 40 + margin, 30 + margin])
  })
})

describe('siteContext on a recorded Bangkok response', () => {
  const context = siteContext(site)

  it('keeps every building with its mapped height range', () => {
    expect(context.buildings).toHaveLength(site.buildings.length)
    context.buildings.forEach((b, i) => {
      expect([b.baseM, b.topM]).toEqual([site.buildings[i].minHeightM, site.buildings[i].heightM])
      expect(b.guessed).toBe(site.buildings[i].heightSource === 'default')
      expect(b.polygon.holes).toHaveLength(site.buildings[i].holes.length)
    })
    expect(context.buildings.some((b) => b.guessed)).toBe(true)
    expect(context.buildings.some((b) => !b.guessed)).toBe(true)
  })

  it('projects footprints into metres around the centre of the site box', () => {
    const halfWidth = localFrame([site.bbox[0], site.bbox[1]]).toLocal([site.bbox[2], site.bbox[3]]).map((side) => side / 2 + 1)
    context.buildings.forEach((b) =>
      b.polygon.outer.forEach(([x, y]) => {
        expect(Math.abs(x)).toBeLessThan(halfWidth[0])
        expect(Math.abs(y)).toBeLessThan(halfWidth[1])
      }),
    )
    const areas = context.buildings.map((b) => polygonArea(b.polygon))
    expect(Math.min(...areas)).toBeGreaterThan(1)
  })

  it('drops tunnels and keeps ground and elevated roads with their widths', () => {
    const tunnel = { ...site.roads[0], id: 'tunnel', grade: 'tunnel' as const }
    const bridge = { ...site.roads[0], id: 'bridge', grade: 'elevated' as const, widthM: 7 }
    const { roads } = siteContext({ ...site, roads: [tunnel, bridge] })
    expect(roads.map((r) => r.widthM)).toEqual([7])
  })
})

describe('standingBuildings', () => {
  const plot = rectangle(0, 0, 40, 30)

  it('clears buildings standing on the plot and keeps the neighbours', () => {
    const onPlot = block(5, 5, 20, 15)
    const mostlyOn = block(30, 10, 20, 10)
    const grazing = block(36, -20, 10, 25)
    const sharingWall = block(40, 0, 15, 30)
    const across = block(-60, -60, 20, 20)
    expect(standingBuildings([onPlot, mostlyOn, grazing, sharingWall, across], plot)).toEqual([grazing, sharingWall, across])
  })

  it('counts a courtyard as open ground, not as building on the plot', () => {
    const ring = { ...block(-30, -30, 100, 90), polygon: { outer: rectangle(-30, -30, 100, 90), holes: [rectangle(-5, -5, 50, 40)] } }
    expect(standingBuildings([ring], plot)).toEqual([ring])
  })

  it('clears a real building when the plot is drawn on its footprint, and keeps every building clear of the plot', () => {
    const { buildings } = siteContext(site)
    fc.assert(
      fc.property(fc.integer({ min: 0, max: buildings.length - 1 }), (index) => {
        const footprint = buildings[index].polygon.outer
        const standing = standingBuildings(buildings, footprint)
        expect(standing).not.toContain(buildings[index])
        buildings
          .filter((b) => !extentsMeet(extentOf(b.polygon.outer), extentOf(footprint)))
          .forEach((b) => expect(standing).toContain(b))
      }),
      { numRuns: 50 },
    )
  })
})
