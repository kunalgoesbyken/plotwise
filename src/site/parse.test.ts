import { describe, expect, it } from 'bun:test'
import { REGIONS } from '@/region/regions'
import fixture from './__fixtures__/ratchadaphisek.overpass.json'
import { DEFAULT_BUILDING_HEIGHT_M, ROAD_WIDTH_BY_CLASS_M } from './assumptions'
import { OverpassResponseSchema, type OverpassResponse } from './overpass-response'
import { parseOverpass } from './parse'
import { SiteDataSchema, type Building, type Road } from './schema'
import { signedArea } from './ring'

function countBy<T>(items: T[], key: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((counts, item) => ({ ...counts, [key(item)]: (counts[key(item)] ?? 0) + 1 }), {})
}

describe('parseOverpass on a recorded central-Bangkok response', () => {
  const response = OverpassResponseSchema.parse(fixture)
  const site = parseOverpass(response, REGIONS.bkk.transit)

  it('produces output that satisfies the public schema', () => {
    expect(SiteDataSchema.safeParse(site).success).toBe(true)
  })

  it('keeps every building way in the recording', () => {
    expect(site.buildings).toHaveLength(98)
    expect(new Set(site.buildings.map((b) => b.id)).size).toBe(98)
  })

  it('keeps counter-clockwise outer rings without a repeated closing point', () => {
    site.buildings.forEach((building) => {
      expect(signedArea(building.outer)).toBeGreaterThan(0)
      expect(building.outer[0]).not.toEqual(building.outer[building.outer.length - 1])
    })
  })

  it('marks where each height came from: 2 height tags, 30 levels, 66 defaults', () => {
    expect(countBy(site.buildings, (b: Building) => b.heightSource)).toEqual({ default: 66, levels: 30, height: 2 })
  })

  it('has height or levels on 32.7% of buildings in this sample', () => {
    const known = site.buildings.filter((b) => b.heightSource !== 'default')
    expect(known.length / site.buildings.length).toBeCloseTo(0.327, 3)
  })

  it('falls back to the default for mis-tagged levels such as "3;2" and "/"', () => {
    const defaulted = site.buildings.filter((b) => b.heightSource === 'default')
    expect(defaulted.every((b) => b.heightM === DEFAULT_BUILDING_HEIGHT_M.value)).toBe(true)
    const mistagged = response.elements.filter(
      (e) => e.type === 'way' && ['3;2', '/'].includes(e.tags['building:levels']),
    )
    expect(mistagged).toHaveLength(2)
    mistagged.forEach((e) => {
      expect(site.buildings.find((b) => b.id === `way/${e.id}`)?.heightSource).toBe('default')
    })
  })

  it('reads the two tall towers from their height tags', () => {
    const tall = site.buildings.filter((b) => b.heightSource === 'height').map((b) => b.heightM)
    expect(tall.sort((a, b) => a - b)).toEqual([127, 139])
  })

  it('keeps every drivable road, with Thai names intact', () => {
    expect(site.roads).toHaveLength(63)
    expect(site.roads.some((r) => r.nameTh === 'ถนนรัชดาภิเษก')).toBe(true)
  })

  it('marks where each road width came from: 8 lanes, 55 class defaults, no width tags', () => {
    expect(countBy(site.roads, (r: Road) => r.widthSource)).toEqual({ lanes: 8, class: 55 })
  })

  it('uses the class table for untagged roads', () => {
    site.roads
      .filter((r) => r.widthSource === 'class')
      .forEach((road) => expect(road.widthM).toBe(ROAD_WIDTH_BY_CLASS_M.value[road.highway]))
  })

  it('flags the two elevated service roads', () => {
    expect(countBy(site.roads, (r: Road) => r.grade)).toEqual({ ground: 61, elevated: 2 })
  })
})

describe('parseOverpass', () => {
  it('drops an outline covered by its parts and keeps the parts', () => {
    const square = (size: number) => [
      { lon: 100, lat: 13 },
      { lon: 100 + size, lat: 13 },
      { lon: 100 + size, lat: 13 + size },
      { lon: 100, lat: 13 + size },
      { lon: 100, lat: 13 },
    ]
    const response: OverpassResponse = {
      elements: [
        { type: 'way', id: 1, tags: { building: 'yes' }, geometry: square(0.001) },
        { type: 'way', id: 2, tags: { 'building:part': 'yes', height: '50' }, geometry: square(0.001) },
      ],
    }
    expect(parseOverpass(response, REGIONS.bkk.transit).buildings.map((b) => b.id)).toEqual(['way/2'])
  })
})
