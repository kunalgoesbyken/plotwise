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
    expect(decodePlot(encodePlot(plot))).toMatchObject({ ok: true, plot: { nearStation: false } })
    expect(decodePlot(`${encodePlot(plot)}&station=1`)).toMatchObject({ ok: true, plot: { nearStation: true } })
  })

  it('decodes what it encodes, with or without the leading #', () => {
    expect(decodePlot(encodePlot(plot))).toEqual({ ok: true, plot })
    expect(decodePlot(`#${encodePlot(plot)}`)).toEqual({ ok: true, plot })
  })

  it('round-trips any plot exactly', () => {
    fc.assert(
      fc.property(plots, (p) => {
        expect(decodePlot(encodePlot(p))).toEqual({ ok: true, plot: p })
      }),
    )
  })

  it('ignores a fragment that is not a plot link', () => {
    for (const hash of ['', '#', '#section', '%E0%A4%A']) expect(decodePlot(hash)).toBeNull()
  })

  it('says a link is incomplete when part of the plot is missing', () => {
    const good = encodePlot(plot)
    for (const hash of [good.replace('&type=hotel', ''), good.replace('&roads=0:16;3:6.5', ''), 'plot=100.53,13.724']) {
      expect(decodePlot(hash)).toEqual({ ok: false, problem: 'link-incomplete' })
    }
  })

  it('says a link is invalid when its plot breaks the contract', () => {
    const good = encodePlot(plot)
    const broken = [
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
      `${good}&station=yes`,
      `${good}&station=0`,
    ]
    for (const hash of broken) expect(decodePlot(hash)).toEqual({ ok: false, problem: 'link-invalid' })
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
