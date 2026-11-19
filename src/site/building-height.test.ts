import { describe, expect, it } from 'bun:test'
import { DEFAULT_BUILDING_HEIGHT_M, MAX_PLAUSIBLE_HEIGHT_M, METRES_PER_LEVEL } from './assumptions'
import { resolveBuildingHeight } from './building-height'

const perLevel = METRES_PER_LEVEL.value
const defaultHeight = DEFAULT_BUILDING_HEIGHT_M.value

describe('resolveBuildingHeight', () => {
  it('prefers the height tag', () => {
    expect(resolveBuildingHeight({ height: '127', 'building:levels': '10' })).toEqual({
      heightM: 127,
      heightSource: 'height',
      minHeightM: 0,
    })
  })

  it('parses units on the height tag', () => {
    expect(resolveBuildingHeight({ height: '40 ft' }).heightM).toBeCloseTo(12.192, 3)
  })

  it('falls back to levels times metres per level', () => {
    expect(resolveBuildingHeight({ 'building:levels': '10' })).toEqual({
      heightM: 10 * perLevel,
      heightSource: 'levels',
      minHeightM: 0,
    })
  })

  it('falls back to levels when the height tag is unparseable', () => {
    expect(resolveBuildingHeight({ height: 'tall', 'building:levels': '4' }).heightSource).toBe('levels')
  })

  it.each(['3;2', '/', '0', '-1', 'many'])('falls back to the default when levels is %p', (levels) => {
    expect(resolveBuildingHeight({ 'building:levels': levels })).toEqual({
      heightM: defaultHeight,
      heightSource: 'default',
      minHeightM: 0,
    })
  })

  it('uses the default when nothing is tagged', () => {
    expect(resolveBuildingHeight({})).toEqual({ heightM: defaultHeight, heightSource: 'default', minHeightM: 0 })
  })

  it('treats an implausible height as unparseable', () => {
    const tooTall = String(MAX_PLAUSIBLE_HEIGHT_M.value + 1)
    expect(resolveBuildingHeight({ height: tooTall }).heightSource).toBe('default')
    expect(resolveBuildingHeight({ 'building:levels': '9999' }).heightSource).toBe('default')
  })

  it('reads min_height and building:min_level', () => {
    expect(resolveBuildingHeight({ height: '30', min_height: '10' }).minHeightM).toBe(10)
    expect(resolveBuildingHeight({ height: '30', 'building:min_level': '2' }).minHeightM).toBe(2 * perLevel)
  })

  it('prefers min_height over building:min_level', () => {
    expect(resolveBuildingHeight({ height: '30', min_height: '10', 'building:min_level': '2' }).minHeightM).toBe(10)
  })

  it('ignores a minimum that is not below the height', () => {
    expect(resolveBuildingHeight({ height: '10', min_height: '10' }).minHeightM).toBe(0)
    expect(resolveBuildingHeight({ min_height: '50' }).minHeightM).toBe(0)
  })
})
