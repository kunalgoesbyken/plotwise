import { describe, expect, it } from 'bun:test'
import type { OverpassResponse } from './overpass-response'
import { StationSchema } from './schema'
import { parseStationElements } from './stations'

type Element = OverpassResponse['elements'][number]

const node = (id: number, tags: Record<string, string>): Element => ({ type: 'node', id, lat: 13.7, lon: 100.5, tags })

const way = (id: number, tags: Record<string, string>, points: [number, number][]): Element => ({
  type: 'way',
  id,
  tags,
  geometry: points.map(([lon, lat]) => ({ lon, lat })),
})

const square: [number, number][] = [
  [100.5, 13.7],
  [100.501, 13.7],
  [100.501, 13.701],
  [100.5, 13.701],
  [100.5, 13.7],
]

describe('parseStationElements', () => {
  it('reads a closed platform way as an area without the repeated closing point', () => {
    const [platform] = parseStationElements([way(1, { railway: 'platform', public_transport: 'platform', subway: 'yes' }, square)])
    expect(platform).toEqual({ id: 'way/1', kind: 'platform', geometry: { type: 'area', ring: square.slice(0, -1) } })
  })

  it('reads an open platform way as a line', () => {
    const [platform] = parseStationElements([way(2, { public_transport: 'platform', train: 'yes' }, square.slice(0, 2))])
    expect(platform.geometry).toEqual({ type: 'line', line: square.slice(0, 2) })
  })

  it('reads a platform node as a point and keeps only its English name', () => {
    const [platform] = parseStationElements([node(3, { public_transport: 'platform', monorail: 'yes', name: 'Lat Phrao', 'name:th': 'ลาดพร้าว' })])
    expect(platform).toEqual({
      id: 'node/3',
      name: 'Lat Phrao',
      kind: 'platform',
      geometry: { type: 'point', at: [100.5, 13.7] },
    })
  })

  it('reads a mass-transit station node as a station point, and drops a name only in Thai script', () => {
    const [station] = parseStationElements([node(4, { railway: 'station', station: 'subway', name: 'อโศก' })])
    expect(station).toEqual({ id: 'node/4', kind: 'station', geometry: { type: 'point', at: [100.5, 13.7] } })
  })

  it('skips bus platforms, intercity station nodes, buildings, roads and broken geometry', () => {
    const stations = parseStationElements([
      node(5, { public_transport: 'platform', bus: 'yes' }),
      node(6, { railway: 'station', train: 'yes' }),
      way(7, { building: 'yes' }, square),
      way(8, { highway: 'primary' }, square.slice(0, 2)),
      way(9, { railway: 'platform' }, square.slice(0, 1)),
      { type: 'way', id: 10, tags: { railway: 'platform' } },
    ])
    expect(stations).toEqual([])
  })

  it('produces stations that satisfy the public schema', () => {
    const stations = parseStationElements([
      way(1, { railway: 'platform' }, square),
      node(4, { railway: 'station', station: 'monorail' }),
    ])
    expect(stations.every((station) => StationSchema.safeParse(station).success)).toBe(true)
  })
})
