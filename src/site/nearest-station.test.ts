import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import { localFrame, type LngLat, type Vec2 } from '@/geo/projection'
import { STATION_PLATFORM_RADIUS_M } from './assumptions'
import { nearestStation } from './nearest-station'
import type { Station } from './schema'

const frame = localFrame([100.5603, 13.737])
const at = ([x, y]: Vec2): LngLat => frame.toLngLat([x, y])
const plot = (
  [
    [0, 0],
    [40, 0],
    [40, 30],
    [0, 30],
  ] as Vec2[]
).map(at)

function platformArea(id: string, [x0, y0, x1, y1]: [number, number, number, number], names: Partial<Station> = {}): Station {
  const ring = ([[x0, y0], [x1, y0], [x1, y1], [x0, y1]] as Vec2[]).map(at)
  return { id, kind: 'platform', geometry: { type: 'area', ring }, ...names }
}

function stationNode(id: string, point: Vec2, names: Partial<Station> = {}): Station {
  return { id, kind: 'station', geometry: { type: 'point', at: at(point) }, ...names }
}

function platformLine(id: string, points: Vec2[]): Station {
  return { id, kind: 'platform', geometry: { type: 'line', line: points.map(at) } }
}

const asok = { name: 'Asok', nameTh: 'อโศก' }
const platform = platformArea('platform', [100, 0, 250, 10])
const node = stationNode('node', [175, 5], asok)

describe('nearestStation', () => {
  it('returns null when no station is mapped nearby', () => {
    expect(nearestStation(plot, [])).toBeNull()
  })

  it('measures from the plot boundary to the platform edge and names it after its station', () => {
    const result = nearestStation(plot, [platform, node])
    expect(result).toEqual({ ...asok, distanceM: expect.closeTo(60, 3), measuredFrom: 'platform' })
  })

  it('prefers the platform even when the station node is closer to the plot', () => {
    const offPlatform = stationNode('node', [90, 5], asok)
    expect(nearestStation(plot, [platform, offPlatform])).toEqual({
      ...asok,
      distanceM: expect.closeTo(60, 3),
      measuredFrom: 'platform',
    })
  })

  it('falls back to the station node when it has no platform mapped, and says so', () => {
    const lone = stationNode('lone', [20, 130], { name: 'Phetchaburi' })
    expect(nearestStation(plot, [lone])).toEqual({ name: 'Phetchaburi', distanceM: expect.closeTo(100, 3), measuredFrom: 'station' })
    expect(nearestStation(plot, [platform, node, lone])?.measuredFrom).toBe('platform')
  })

  it('treats a node farther than the platform radius from any platform as unmapped', () => {
    const radius = STATION_PLATFORM_RADIUS_M.value
    const beside = stationNode('beside', [20, 30 + 40], { name: 'Beside' })
    const farPlatform = platformArea('far', [20 - 5, 30 + 40 + radius + 1, 20 + 5, 30 + 40 + radius + 11])
    expect(nearestStation(plot, [beside, farPlatform])).toEqual({ name: 'Beside', distanceM: expect.closeTo(40, 3), measuredFrom: 'station' })
  })

  it('keeps a platform name over the name of its station, and takes the rest from the station', () => {
    const named = platformArea('named', [100, 0, 250, 10], { name: 'Sukhumvit' })
    expect(nearestStation(plot, [named, node])?.name).toBe('Sukhumvit')
    expect(nearestStation(plot, [named, node])?.nameTh).toBe(asok.nameTh)
  })

  it('fills a name the platform lacks from its station', () => {
    const thaiOnly = platformArea('thai', [100, 0, 250, 10], { nameTh: 'สุขุมวิท' })
    expect(nearestStation(plot, [thaiOnly, node])).toMatchObject({ name: asok.name, nameTh: 'สุขุมวิท' })
  })

  it('is zero when a platform touches, crosses or lies inside the plot', () => {
    expect(nearestStation(plot, [platformArea('over', [30, 10, 80, 20])])?.distanceM).toBe(0)
    expect(nearestStation(plot, [platformLine('across', [[-10, 15], [60, 15]])])?.distanceM).toBe(0)
    expect(nearestStation(plot, [platformLine('inside', [[10, 10], [20, 10]])])?.distanceM).toBe(0)
    expect(nearestStation(plot, [platformArea('around', [-100, -100, 100, 100])])?.distanceM).toBe(0)
  })

  it('measures a point platform to the nearest point of a rectangular plot', () => {
    fc.assert(
      fc.property(fc.double({ min: -600, max: 600, noNaN: true }), fc.double({ min: -600, max: 600, noNaN: true }), (x, y) => {
        const point: Station = { id: 'p', kind: 'platform', geometry: { type: 'point', at: at([x, y]) } }
        const expected = Math.hypot(Math.max(0, -x, x - 40), Math.max(0, -y, y - 30))
        expect(nearestStation(plot, [point])!.distanceM).toBeCloseTo(expected, 3)
      }),
    )
  })
})
