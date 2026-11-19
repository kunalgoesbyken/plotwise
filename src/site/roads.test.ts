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
        oneway: false,
      },
    ])
  })

  it('reads English from name:en and Thai from name:th, or from a name written in Thai script', () => {
    const [thaiName] = parseRoadElements([way(1, { highway: 'residential', name: 'ซอยสาทร 1', 'name:en': 'Soi Sathon 1' })])
    expect(thaiName).toMatchObject({ name: 'Soi Sathon 1', nameTh: 'ซอยสาทร 1' })
    const [latinName] = parseRoadElements([way(2, { highway: 'residential', name: 'Soi Sathon 1' })])
    expect(latinName.name).toBe('Soi Sathon 1')
    expect(latinName).not.toHaveProperty('nameTh')
  })

  it('omits names that are not tagged', () => {
    const [road] = parseRoadElements([way(1, { highway: 'residential' })])
    expect(road).not.toHaveProperty('name')
    expect(road).not.toHaveProperty('nameTh')
    expect(road.widthSource).toBe('class')
  })

  it('keeps the road reference so carriageways can be matched without a name', () => {
    const [road] = parseRoadElements([way(1, { highway: 'trunk', ref: '31' })])
    expect(road.ref).toBe('31')
    expect(parseRoadElements([way(2, { highway: 'trunk' })])[0]).not.toHaveProperty('ref')
  })

  it.each([
    ['yes', true],
    ['1', true],
    ['true', true],
    ['no', false],
    ['reversible', false],
  ])('reads oneway=%p as one-way %p, keeping the drawn direction', (oneway, expected) => {
    const [road] = parseRoadElements([way(1, { highway: 'primary', oneway })])
    expect(road.oneway).toBe(expected)
    expect(road.line[0]).toEqual([100.5, 13.7])
  })

  it('reverses a oneway=-1 road so its line always runs in the direction of travel', () => {
    const [road] = parseRoadElements([way(1, { highway: 'primary', oneway: '-1' })])
    expect(road.oneway).toBe(true)
    expect(road.line).toEqual([
      [100.501, 13.7],
      [100.5, 13.7],
    ])
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
      { type: 'node', id: 4, lat: 13.7, lon: 100.5, tags: { highway: 'primary' } },
      { type: 'way', id: 5, tags: { highway: 'primary' } },
      way(6, { highway: 'primary' }, [{ lon: 100.5, lat: 13.7 }]),
      way(7, { highway: 'primary' }, [{ lon: 100.5, lat: 13.7 }, null, { lon: 100.6, lat: 13.7 }]),
    ])
    expect(roads).toEqual([])
  })
})
