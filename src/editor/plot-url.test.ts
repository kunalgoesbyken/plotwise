import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import { BUILDING_TYPES, type Plot } from '@/plot/plot'
import { roundLngLat } from './plot-draft'
import { decodePlot, encodePlot } from './plot-url'

const plot: Plot = {
  ring: [
    [100.53, 13.724],
    [100.532, 13.724],
    [100.532, 13.725],
    [100.531, 13.725],
    [100.531, 13.726],
    [100.53, 13.726],
  ],
  roads: [
    { edge: 0, widthM: 16 },
    { edge: 3, widthM: 6.5 },
  ],
  buildingType: 'hotel',
  nearStation: false,
}

const coordinate = (min: number, max: number) => fc.double({ min, max, noNaN: true })

const plots = fc
  .record({
    ring: fc.array(fc.tuple(coordinate(-180, 180), coordinate(-90, 90)).map(roundLngLat), { minLength: 3, maxLength: 12 }),
    widths: fc.array(fc.double({ min: 0.5, max: 80, noNaN: true }), { minLength: 1, maxLength: 3 }),
    buildingType: fc.constantFrom(...BUILDING_TYPES),
    nearStation: fc.boolean(),
  })
  .map(({ ring, widths, buildingType, nearStation }): Plot => ({
    ring,
    roads: widths.map((widthM, edge) => ({ edge, widthM })),
    buildingType,
    nearStation,
  }))

describe('plot URL encoding', () => {
  it('writes a short, readable fragment', () => {
    expect(encodePlot(plot)).toBe(
      'plot=100.53,13.724;100.532,13.724;100.532,13.725;100.531,13.725;100.531,13.726;100.53,13.726&roads=0:16;3:6.5&type=hotel',
    )
  })

  it('adds the station flag only when it is set, so links made before it existed still open', () => {
    expect(encodePlot({ ...plot, nearStation: true })).toBe(`${encodePlot(plot)}&station=1`)
    expect(decodePlot(encodePlot(plot))?.nearStation).toBe(false)
    expect(decodePlot(`${encodePlot(plot)}&station=1`)?.nearStation).toBe(true)
  })

  it('decodes what it encodes, with or without the leading #', () => {
    expect(decodePlot(encodePlot(plot))).toEqual(plot)
    expect(decodePlot(`#${encodePlot(plot)}`)).toEqual(plot)
  })

  it('round-trips any plot exactly', () => {
    fc.assert(
      fc.property(plots, (p) => {
        expect(decodePlot(encodePlot(p))).toEqual(p)
      }),
    )
  })

  it('returns null for malformed fragments', () => {
    const good = encodePlot(plot)
    const broken = [
      '',
      '#',
      'plot=',
      good.replace('type=hotel', 'type=castle'),
      good.replace('roads=0:16;3:6.5', 'roads='),
      good.replace('roads=0:16;3:6.5', 'roads=0:'),
      good.replace('roads=0:16;3:6.5', 'roads=9:16'),
      good.replace('roads=0:16;3:6.5', 'roads=0:-4'),
      good.replace('roads=0:16;3:6.5', 'roads=0:16;0:8'),
      good.replace('100.53,13.724;', '100.53;'),
      good.replace('100.53,13.724;', '100.53,13.724,7;'),
      good.replace('100.53,13.724;', ',13.724;'),
      good.replace('100.53,13.724;', '1e999,13.724;'),
      good.replace('100.53,13.724;', '100.53,95;'),
      good.replace('&type=hotel', ''),
      `${good}&station=yes`,
      `${good}&station=0`,
      '%E0%A4%A',
    ]
    for (const hash of broken) expect(decodePlot(hash)).toBeNull()
  })

  it('never throws on arbitrary input', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        decodePlot(s)
        decodePlot(`plot=${s}&roads=${s}&type=condo`)
      }),
    )
  })
})
