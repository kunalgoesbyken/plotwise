import { describe, expect, it } from 'bun:test'
import { LANE_WIDTH_M, MAX_PLAUSIBLE_LANES, MAX_PLAUSIBLE_ROAD_WIDTH_M, ROAD_WIDTH_BY_CLASS_M } from './assumptions'
import { resolveRoadGrade, resolveRoadWidth } from './road-width'

describe('resolveRoadWidth', () => {
  it('prefers the width tag', () => {
    expect(resolveRoadWidth({ width: '14.5', lanes: '4' }, 'primary')).toEqual({ widthM: 14.5, widthSource: 'width' })
  })

  it('parses units on the width tag', () => {
    expect(resolveRoadWidth({ width: '30 ft' }, 'residential').widthM).toBeCloseTo(9.144, 3)
  })

  it('falls back to lanes times lane width', () => {
    expect(resolveRoadWidth({ lanes: '4' }, 'primary')).toEqual({ widthM: 4 * LANE_WIDTH_M.value, widthSource: 'lanes' })
  })

  it('falls back to lanes when the width tag is unparseable', () => {
    expect(resolveRoadWidth({ width: 'narrow', lanes: '2' }, 'secondary').widthSource).toBe('lanes')
  })

  it('falls back to the highway class', () => {
    expect(resolveRoadWidth({}, 'residential')).toEqual({
      widthM: ROAD_WIDTH_BY_CLASS_M.value.residential,
      widthSource: 'class',
    })
  })

  it.each(['2;3', '0', 'two'])('falls back to the class when lanes is %p', (lanes) => {
    expect(resolveRoadWidth({ lanes }, 'tertiary').widthSource).toBe('class')
  })

  it('treats implausible values as mis-tags', () => {
    expect(resolveRoadWidth({ width: String(MAX_PLAUSIBLE_ROAD_WIDTH_M.value + 1) }, 'service').widthSource).toBe('class')
    expect(resolveRoadWidth({ lanes: String(MAX_PLAUSIBLE_LANES.value + 1) }, 'service').widthSource).toBe('class')
  })
})

describe('resolveRoadGrade', () => {
  it('is ground by default', () => {
    expect(resolveRoadGrade({})).toBe('ground')
  })

  it('treats bridges and positive layers as elevated', () => {
    expect(resolveRoadGrade({ bridge: 'yes' })).toBe('elevated')
    expect(resolveRoadGrade({ layer: '2' })).toBe('elevated')
  })

  it('treats tunnels and negative layers as tunnel', () => {
    expect(resolveRoadGrade({ tunnel: 'yes' })).toBe('tunnel')
    expect(resolveRoadGrade({ layer: '-1' })).toBe('tunnel')
  })

  it('keeps building passages and bridge=no at ground level', () => {
    expect(resolveRoadGrade({ tunnel: 'building_passage' })).toBe('ground')
    expect(resolveRoadGrade({ bridge: 'no', tunnel: 'no' })).toBe('ground')
  })
})
