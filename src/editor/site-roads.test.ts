import { describe, expect, it } from 'bun:test'
import { localFrame } from '@/geo/projection'
import { NEAREST_ROAD_MAX_GAP_M } from '@/site/assumptions'
import { roadSearchBbox } from './site-roads'

describe('roadSearchBbox', () => {
  it('covers the outline plus room for a road across the widest allowed gap', () => {
    const frame = localFrame([100.53, 13.724])
    const ring = [frame.toLngLat([0, 0]), frame.toLngLat([40, 0]), frame.toLngLat([40, 30])]
    const [minLng, minLat, maxLng, maxLat] = roadSearchBbox(ring)
    const [west, south] = frame.toLocal([minLng, minLat])
    const [east, north] = frame.toLocal([maxLng, maxLat])
    const margin = 2 * NEAREST_ROAD_MAX_GAP_M.value
    expect(west).toBeCloseTo(-margin, 3)
    expect(south).toBeCloseTo(-margin, 3)
    expect(east).toBeCloseTo(40 + margin, 3)
    expect(north).toBeCloseTo(30 + margin, 3)
  })
})
