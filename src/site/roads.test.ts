import { describe, expect, it } from 'bun:test'
import { LANE_WIDTH_M } from './assumptions'
import type { OverpassResponse, OverpassWay } from './overpass-response'
import { parseRoadElements } from './roads'

type Element = OverpassResponse['elements'][number]

const line = [
  { lon: 100.5, lat: 13.7 },
  { lon: 100.501, lat: 13.7 },
]

const way = (id: number, tags: Record<string, string>, geometry: OverpassWay['geometry'] = line): Element => ({
  type: 'way',
  id,
  tags,
  geometry,
})

describe('parseRoadElements', () => {
  it('parses a road with names, class and a width source', () => {
    const roads = parseRoadElements([
      way(1, { highway: 'primary', lanes: '4', name: 'Ratchadaphisek Road', 'name:th': 'ถนนรัชดาภิเษก' }),
    ])
    expect(roads).toEqual([
      {
        id: 'way/1',
        line: [
          [100.5, 13.7],
          [100.501, 13.7],
        ],
        name: 'Ratchadaphisek Road',
        nameTh: 'ถนนรัชดาภิเษก',
        highway: 'primary',
        widthM: 4 * LANE_WIDTH_M.value,
        widthSource: 'lanes',
        grade: 'ground',
      },
    ])
  })

  it('omits names that are not tagged', () => {
    const [road] = parseRoadElements([way(1, { highway: 'residential' })])
    expect(road).not.toHaveProperty('name')
    expect(road).not.toHaveProperty('nameTh')
    expect(road.widthSource).toBe('class')
  })

  it('marks elevated roads', () => {
    const [road] = parseRoadElements([way(1, { highway: 'motorway', bridge: 'yes', layer: '2' })])
    expect(road.grade).toBe('elevated')
  })

  it('skips highway classes that are not roads, buildings, nodes and ways without geometry', () => {
    const roads = parseRoadElements([
      way(1, { highway: 'footway' }),
      way(2, { highway: 'steps' }),
      way(3, { building: 'yes' }),
      { type: 'node', id: 4 },
      { type: 'way', id: 5, tags: { highway: 'primary' } },
      way(6, { highway: 'primary' }, [{ lon: 100.5, lat: 13.7 }]),
      way(7, { highway: 'primary' }, [{ lon: 100.5, lat: 13.7 }, null, { lon: 100.6, lat: 13.7 }]),
    ])
    expect(roads).toEqual([])
  })
})
