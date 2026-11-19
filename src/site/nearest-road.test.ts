import { describe, expect, it } from 'bun:test'
import { localFrame, type LngLat, type Vec2 } from '@/geo/projection'
import fixture from './__fixtures__/ratchadaphisek.overpass.json'
import { MAX_MEDIAN_WIDTH_M, NEAREST_ROAD_MAX_GAP_M } from './assumptions'
import { nearestRoad } from './nearest-road'
import { OverpassResponseSchema } from './overpass-response'
import { parseOverpass } from './parse'
import type { Road } from './schema'

const RATCHADAPHISEK_CENTRELINES_FROM_EDGE_MIDPOINT_M = [14.12, 33.0]
const RATCHADAPHISEK_LANES_WIDTH_M = 13
const RATCHADAPHISEK_KERB_TO_KERB_M =
  RATCHADAPHISEK_CENTRELINES_FROM_EDGE_MIDPOINT_M[1] - RATCHADAPHISEK_CENTRELINES_FROM_EDGE_MIDPOINT_M[0] + RATCHADAPHISEK_LANES_WIDTH_M

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
    oneway: false,
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
    expect(result?.carriageways).toBe(1)
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

  it('finds both carriageways of Ratchadaphisek Road for a building edge facing it in the recorded sample', () => {
    const site = parseOverpass(OverpassResponseSchema.parse(fixture))
    const building = site.buildings.find((b) => b.id === 'way/369892554')
    const result = nearestRoad([building!.outer[1], building!.outer[2]], site.roads)
    expect(result?.road.nameTh).toBe('ถนนรัชดาภิเษก')
    expect(result?.road.highway).toBe('primary')
    expect(result?.distanceM).toBeCloseTo(9.5, 1)
    expect(result?.carriageways).toBe(2)
    expect(result?.widthM).toBeCloseTo(RATCHADAPHISEK_KERB_TO_KERB_M, 0)
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

describe('nearestRoad on a divided road', () => {
  const lanes = { oneway: true, widthM: 13, widthSource: 'lanes', name: 'Ratchadaphisek Road' } as const
  const near = road('near', [[-20, -10], [60, -10]], lanes)
  const opposite = (y: number, overrides: Partial<Road> = {}) => road('opposite', [[60, y], [-20, y]], { ...lanes, ...overrides })

  it('adds the opposite carriageway and the median, kerb to kerb', () => {
    const result = nearestRoad(edge, [near, opposite(-30)])
    expect(result?.road.id).toBe('near')
    expect(result?.distanceM).toBeCloseTo(10, 1)
    expect(result?.carriageways).toBe(2)
    expect(result?.widthM).toBeCloseTo(20 + 13, 1)
  })

  it('pairs carriageways by Thai name or road reference when the English name is missing', () => {
    const thai = { name: undefined, nameTh: 'ถนนรัชดาภิเษก' }
    expect(nearestRoad(edge, [{ ...near, ...thai }, opposite(-30, thai)])?.carriageways).toBe(2)
    const ref = { name: undefined, ref: '31' }
    expect(nearestRoad(edge, [{ ...near, ...ref }, opposite(-30, ref)])?.carriageways).toBe(2)
  })

  it('keeps one carriageway when there is no opposite carriageway', () => {
    const result = nearestRoad(edge, [near])
    expect(result?.carriageways).toBe(1)
    expect(result?.widthM).toBe(13)
  })

  it('does not pair roads with different names, or with no name or reference at all', () => {
    expect(nearestRoad(edge, [near, opposite(-30, { name: 'Din Daeng Road' })])?.carriageways).toBe(1)
    const unnamed = { name: undefined }
    expect(nearestRoad(edge, [{ ...near, ...unnamed }, opposite(-30, unnamed)])?.carriageways).toBe(1)
  })

  it('does not pair a carriageway whose median would be wider than the limit', () => {
    const atLimit = -10 - 13 - MAX_MEDIAN_WIDTH_M.value
    expect(nearestRoad(edge, [near, opposite(atLimit + 0.5)])?.carriageways).toBe(2)
    expect(nearestRoad(edge, [near, opposite(atLimit - 0.5)])?.carriageways).toBe(1)
  })

  it('does not pair a parallel road running the same way, a two-way road or an elevated road', () => {
    const sameWay = road('same-way', [[-20, -30], [60, -30]], lanes)
    expect(nearestRoad(edge, [near, sameWay])?.carriageways).toBe(1)
    expect(nearestRoad(edge, [near, opposite(-30, { oneway: false })])?.carriageways).toBe(1)
    expect(nearestRoad(edge, [near, opposite(-30, { grade: 'elevated' })])?.carriageways).toBe(1)
  })

  it('does not pair a carriageway on the other side of the plot', () => {
    expect(nearestRoad(edge, [near, opposite(20)])?.carriageways).toBe(1)
  })

  it('pairs with the nearest opposite carriageway when there are several', () => {
    const result = nearestRoad(edge, [near, opposite(-40), opposite(-30)])
    expect(result?.widthM).toBeCloseTo(33, 1)
  })
})
