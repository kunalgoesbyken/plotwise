import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import { loadPack } from '@/rules'
import { boundarySetback, frontOpenSpaceDepth, heightVsRoadSetback, roadSetback, strictest } from './setbacks'

const pack = loadPack('bkk-y9')
const building = (heightM: number, floorAreaSqm = 5000) => ({ heightM, storeys: Math.max(1, Math.round(heightM / 3)), floorAreaSqm })

describe('boundary setbacks for walls with openings, by building height', () => {
  it('reads 2 m up to 9 m, 3 m below the high-rise line, and 6 m for a high-rise', () => {
    expect(boundarySetback(pack, building(6), 'boundary').distanceM).toBe(2)
    expect(boundarySetback(pack, building(9), 'boundary').distanceM).toBe(2)
    expect(boundarySetback(pack, building(9.3), 'boundary').distanceM).toBe(3)
    expect(boundarySetback(pack, building(22.9), 'boundary').distanceM).toBe(3)
    expect(boundarySetback(pack, building(23), 'boundary').distanceM).toBe(6)
  })

  it('treats an extra-large building like a high-rise even when it is low', () => {
    expect(boundarySetback(pack, building(20, 10000), 'boundary').distanceM).toBe(6)
    expect(boundarySetback(pack, building(20, 9999), 'boundary').distanceM).toBe(3)
  })

  it('cites every rule that reaches the governing distance and no other', () => {
    const { cites } = boundarySetback(pack, building(18), 'boundary')
    expect(cites.map((c) => `${c.source} ${c.clause}`).sort()).toEqual(['bb44-03 ข้อ 54', 'mr43-55-upd68 ข้อ 50 (2)'])
  })

  it('applies only the rules measured from a public road to a road edge', () => {
    expect(boundarySetback(pack, building(18), 'road').distanceM).toBe(0)
    expect(boundarySetback(pack, building(30), 'road')).toMatchObject({ distanceM: 6, cites: [{ clause: 'ข้อ 4' }] })
  })

  it('never shrinks as the building gets taller', () => {
    fc.assert(
      fc.property(fc.double({ min: 0.5, max: 200, noNaN: true }), fc.double({ min: 0, max: 50, noNaN: true }), (h, dh) => {
        expect(boundarySetback(pack, building(h + dh), 'boundary').distanceM).toBeGreaterThanOrEqual(
          boundarySetback(pack, building(h), 'boundary').distanceM,
        )
      }),
    )
  })
})

describe('road setbacks by road width', () => {
  const tall = building(30)

  it('measures 6 m from the centreline of a road under 10 m', () => {
    expect(roadSetback(pack, tall, 8).distanceM).toBeCloseTo(2)
    expect(roadSetback(pack, tall, 9.99).distanceM).toBeCloseTo(1.005)
  })

  it('takes a tenth of the width from 10 m to 20 m, then 2 m', () => {
    expect(roadSetback(pack, tall, 10).distanceM).toBeCloseTo(1)
    expect(roadSetback(pack, tall, 20).distanceM).toBeCloseTo(2)
    expect(roadSetback(pack, tall, 30).distanceM).toBe(2)
  })

  it('does not apply to a building of two storeys and 8 m or less', () => {
    expect(roadSetback(pack, { heightM: 6, storeys: 2, floorAreaSqm: 400 }, 8)).toEqual({ distanceM: 0, cites: [] })
    expect(roadSetback(pack, { heightM: 7.5, storeys: 3, floorAreaSqm: 400 }, 8).distanceM).toBeCloseTo(2)
  })

  it('cites both the ministerial regulation and the Bangkok bylaw when they agree', () => {
    expect(new Set(roadSetback(pack, tall, 12).cites.map((c) => c.source))).toEqual(new Set(['mr43-55-upd68', 'bb44-03']))
  })
})

describe('height against the far side of the road', () => {
  it('needs no extra setback until the height reaches twice the road width', () => {
    expect(heightVsRoadSetback(pack, 12, 24).distanceM).toBe(0)
    expect(heightVsRoadSetback(pack, 12, 60).distanceM).toBeCloseTo(18)
  })

  it('grows with height and shrinks with road width', () => {
    fc.assert(
      fc.property(fc.double({ min: 3, max: 60, noNaN: true }), fc.double({ min: 0, max: 300, noNaN: true }), (w, h) => {
        expect(heightVsRoadSetback(pack, w, h + 3).distanceM).toBeGreaterThanOrEqual(heightVsRoadSetback(pack, w, h).distanceM)
        expect(heightVsRoadSetback(pack, w + 2, h).distanceM).toBeLessThanOrEqual(heightVsRoadSetback(pack, w, h).distanceM)
      }),
    )
  })
})

describe('front open space and combining setbacks', () => {
  it('is 6 m deep, or 12 m above three storeys', () => {
    expect(frontOpenSpaceDepth(pack, 3).distanceM).toBe(6)
    expect(frontOpenSpaceDepth(pack, 4).distanceM).toBe(12)
  })

  it('keeps the largest distance with the cites of every rule that sets it', () => {
    const a = { distanceM: 2, cites: [pack.far.definition] }
    const b = { distanceM: 3, cites: [pack.far.max.cite] }
    const c = { distanceM: 3, cites: [pack.zone.cite] }
    expect(strictest([a, b, c])).toEqual({ distanceM: 3, cites: [pack.far.max.cite, pack.zone.cite] })
    expect(strictest([])).toEqual({ distanceM: 0, cites: [] })
  })
})
