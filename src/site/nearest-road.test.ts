import { describe, expect, it } from 'bun:test'
import { localFrame, type LngLat, type Vec2 } from '@/geo/projection'
import fixture from './__fixtures__/ratchadaphisek.overpass.json'
import { NEAREST_ROAD_MAX_GAP_M } from './assumptions'
import { nearestRoad } from './nearest-road'
import { OverpassResponseSchema } from './overpass-response'
import { parseOverpass } from './parse'
import type { Road } from './schema'

const frame = localFrame([100.5018, 13.7563])
const at = (x: number, y: number): LngLat => frame.toLngLat([x, y])
const edge = [at(0, 0), at(40, 0)] as const

function road(id: string, points: Vec2[], overrides: Partial<Road> = {}): Road {
  return {
    id,
    line: points.map(([x, y]) => at(x, y)),
    highway: 'secondary',
    widthM: 12,
    widthSource: 'class',
    grade: 'ground',
    ...overrides,
  }
}

const front = road('front', [
  [-20, -10],
  [60, -10],
])

describe('nearestRoad', () => {
  it('finds a parallel road in front of the edge and reports its distance and width', () => {
    const result = nearestRoad(edge, [front])
    expect(result?.road.id).toBe('front')
    expect(result?.distanceM).toBeCloseTo(10, 1)
    expect(result?.widthM).toBe(12)
  })

  it('is the same whichever way the edge is drawn', () => {
    expect(nearestRoad([edge[1], edge[0]], [front])?.distanceM).toBeCloseTo(10, 1)
  })

  it('finds a road on either side of the edge', () => {
    const behind = road('behind', [
      [-20, 8],
      [60, 8],
    ])
    expect(nearestRoad(edge, [behind])?.distanceM).toBeCloseTo(8, 1)
  })

  it('returns null when there are no roads', () => {
    expect(nearestRoad(edge, [])).toBeNull()
  })

  it('returns null for a zero-length edge', () => {
    expect(nearestRoad([edge[0], edge[0]], [front])).toBeNull()
  })

  it('ignores a road that meets the edge at a right angle', () => {
    const soi = road('soi', [
      [20, -40],
      [20, -2],
    ])
    expect(nearestRoad(edge, [soi])).toBeNull()
  })

  it('accepts a slightly skewed road and rejects a strongly skewed one', () => {
    const skewed = (degrees: number) => {
      const slope = Math.tan((degrees * Math.PI) / 180)
      return road('skewed', [
        [-20, -10 - slope * -20],
        [60, -10 - slope * 60],
      ])
    }
    expect(nearestRoad(edge, [skewed(10)])).not.toBeNull()
    expect(nearestRoad(edge, [skewed(40)])).toBeNull()
  })

  it('ignores a road that lies along the same line but past the end of the edge', () => {
    const beyond = road('beyond', [
      [50, 0],
      [120, 0],
    ])
    expect(nearestRoad(edge, [beyond])).toBeNull()
  })

  it('ignores roads whose kerb is too far from the edge', () => {
    const far = road(
      'far',
      [
        [-20, -(NEAREST_ROAD_MAX_GAP_M.value + 12 / 2 + 5)],
        [60, -(NEAREST_ROAD_MAX_GAP_M.value + 12 / 2 + 5)],
      ],
      { widthM: 12 },
    )
    expect(nearestRoad(edge, [far])).toBeNull()
  })

  it('ranks by the gap to the kerb, so a wide near road beats a narrow slightly nearer one', () => {
    const narrowCloser = road(
      'narrow',
      [
        [-20, -9],
        [60, -9],
      ],
      { widthM: 4 },
    )
    const wideNear = road(
      'wide',
      [
        [-20, -12],
        [60, -12],
      ],
      { widthM: 16 },
    )
    expect(nearestRoad(edge, [narrowCloser, wideNear])?.road.id).toBe('wide')
  })

  it('ignores elevated roads and tunnels', () => {
    const expressway = road(
      'expressway',
      [
        [-20, -3],
        [60, -3],
      ],
      { grade: 'elevated' },
    )
    expect(nearestRoad(edge, [expressway])).toBeNull()
    expect(nearestRoad(edge, [expressway, front])?.road.id).toBe('front')
  })

  it('finds Ratchadaphisek Road for a building edge facing it in the recorded sample', () => {
    const site = parseOverpass(OverpassResponseSchema.parse(fixture))
    const building = site.buildings.find((b) => b.id === 'way/369892554')
    const result = nearestRoad([building!.outer[1], building!.outer[2]], site.roads)
    expect(result?.road.nameTh).toBe('ถนนรัชดาภิเษก')
    expect(result?.road.highway).toBe('primary')
    expect(result?.distanceM).toBeCloseTo(9.5, 1)
    expect(result?.widthM).toBe(13)
  })

  it('uses the part of a bent road that runs alongside the edge', () => {
    const bent = road('bent', [
      [-80, -90],
      [-20, -10],
      [60, -10],
      [100, 60],
    ])
    expect(nearestRoad(edge, [bent])?.distanceM).toBeCloseTo(10, 1)
  })
})
