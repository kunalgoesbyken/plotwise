import { describe, expect, it } from 'bun:test'
import type { LngLat } from '@/geo/projection'
import { parseBuildingElements } from './buildings'
import type { OverpassResponse } from './overpass-response'
import { signedArea } from './ring'

type Element = OverpassResponse['elements'][number]

const square = (x: number, y: number, size: number): LngLat[] => [
  [x, y],
  [x + size, y],
  [x + size, y + size],
  [x, y + size],
  [x, y],
]

const geometry = (line: readonly LngLat[]) => line.map(([lon, lat]) => ({ lon, lat }))

const way = (id: number, tags: Record<string, string>, line: readonly LngLat[]): Element => ({
  type: 'way',
  id,
  tags,
  geometry: geometry(line),
})

const member = (role: string, line: readonly LngLat[], ref = 1) => ({
  type: 'way' as const,
  ref,
  role,
  geometry: geometry(line),
})

const relation = (id: number, tags: Record<string, string>, members: ReturnType<typeof member>[]): Element => ({
  type: 'relation',
  id,
  tags,
  members,
})

describe('parseBuildingElements', () => {
  it('turns a closed building way into a building with a source-tagged height', () => {
    const { outlines, parts } = parseBuildingElements([
      way(7, { building: 'yes', 'building:levels': '10' }, square(100, 13, 0.001)),
    ])
    expect(parts).toEqual([])
    expect(outlines).toHaveLength(1)
    expect(outlines[0]).toMatchObject({ id: 'way/7', heightSource: 'levels', minHeightM: 0, holes: [] })
    expect(outlines[0].outer).toHaveLength(4)
    expect(signedArea(outlines[0].outer)).toBeGreaterThan(0)
  })

  it('separates building:part from building outlines', () => {
    const { outlines, parts } = parseBuildingElements([
      way(1, { building: 'yes' }, square(100, 13, 0.002)),
      way(2, { 'building:part': 'yes', height: '40' }, square(100, 13, 0.001)),
    ])
    expect(outlines.map((b) => b.id)).toEqual(['way/1'])
    expect(parts.map((b) => b.id)).toEqual(['way/2'])
    expect(parts[0].heightM).toBe(40)
  })

  it('treats an element tagged both building and building:part as a part', () => {
    const { outlines, parts } = parseBuildingElements([
      way(1, { building: 'yes', 'building:part': 'yes' }, square(100, 13, 0.001)),
    ])
    expect(outlines).toEqual([])
    expect(parts).toHaveLength(1)
  })

  it('skips building=no, open ways, ways without geometry, highways and nodes', () => {
    const { outlines, parts } = parseBuildingElements([
      way(1, { building: 'no' }, square(100, 13, 0.001)),
      way(2, { building: 'yes' }, square(100, 13, 0.001).slice(0, 3)),
      { type: 'way', id: 3, tags: { building: 'yes' } },
      way(4, { highway: 'residential' }, square(100, 13, 0.001)),
      { type: 'node', id: 5, lat: 13, lon: 100, tags: { building: 'yes' } },
    ])
    expect(outlines).toEqual([])
    expect(parts).toEqual([])
  })

  it('skips a way whose geometry has a missing node', () => {
    const broken: Element = {
      type: 'way',
      id: 1,
      tags: { building: 'yes' },
      geometry: [...geometry(square(100, 13, 0.001)).slice(0, 2), null, ...geometry(square(100, 13, 0.001)).slice(3)],
    }
    expect(parseBuildingElements([broken]).outlines).toEqual([])
  })

  it('builds a multipolygon with a courtyard hole', () => {
    const { outlines } = parseBuildingElements([
      relation(9, { building: 'apartments', type: 'multipolygon', height: '30' }, [
        member('outer', square(100, 13, 0.01)),
        member('inner', square(100.004, 13.004, 0.002), 2),
      ]),
    ])
    expect(outlines).toHaveLength(1)
    expect(outlines[0].id).toBe('relation/9')
    expect(outlines[0].holes).toHaveLength(1)
    expect(signedArea(outlines[0].outer)).toBeGreaterThan(0)
    expect(signedArea(outlines[0].holes[0])).toBeLessThan(0)
  })

  it('assembles an outer ring from several member ways', () => {
    const ring = square(100, 13, 0.01)
    const { outlines } = parseBuildingElements([
      relation(9, { building: 'yes', type: 'multipolygon' }, [
        member('outer', ring.slice(0, 3)),
        member('outer', ring.slice(2), 2),
      ]),
    ])
    expect(outlines).toHaveLength(1)
    expect(outlines[0].outer).toHaveLength(4)
  })

  it('splits a relation with two outer rings into two buildings', () => {
    const { outlines } = parseBuildingElements([
      relation(9, { building: 'yes', type: 'multipolygon' }, [
        member('outer', square(100, 13, 0.001)),
        member('outer', square(100.01, 13, 0.001), 2),
      ]),
    ])
    expect(outlines.map((b) => b.id)).toEqual(['relation/9/0', 'relation/9/1'])
  })

  it('skips relations whose rings cannot be closed and relations that are not multipolygons', () => {
    const { outlines } = parseBuildingElements([
      relation(1, { building: 'yes', type: 'multipolygon' }, [member('outer', square(100, 13, 0.001).slice(0, 3))]),
      relation(2, { building: 'yes', type: 'building' }, [member('outline', square(100, 13, 0.001))]),
    ])
    expect(outlines).toEqual([])
  })

  it('reads building:part relations as parts', () => {
    const { parts } = parseBuildingElements([
      relation(3, { 'building:part': 'yes', type: 'multipolygon' }, [member('outer', square(100, 13, 0.001))]),
    ])
    expect(parts.map((b) => b.id)).toEqual(['relation/3'])
  })
})
