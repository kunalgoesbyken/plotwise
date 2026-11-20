import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import { EXAMPLE_PLOT } from '@/plot/example-plot'
import { BUILDING_TYPES, MAX_CORNERS, type Plot } from '@/plot/plot'
import { REGIONS } from '@/region/regions'
import { ASSUMPTIONS } from '@/solve/assumptions'
import { roundLngLat } from './plot-draft'
import { decodePlot, decodeRegion, encodePlot, encodeRegion, exampleFragment, linkedExample } from './plot-url'

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

  it('opens a plot with the most corners a drawing allows and refuses one with more', () => {
    const corners = (count: number) =>
      Array.from({ length: count }, (_, index) => {
        const angle = (index / count) * 2 * Math.PI
        return `${(100.53 + 0.001 * Math.cos(angle)).toFixed(6)},${(13.72 + 0.001 * Math.sin(angle)).toFixed(6)}`
      }).join(';')
    expect(decodePlot(`plot=${corners(MAX_CORNERS)}&roads=0:12&type=condo`)).toMatchObject({ ok: true })
    expect(decodePlot(`plot=${corners(MAX_CORNERS + 1)}&roads=0:12&type=condo`)).toEqual({ ok: false, problem: 'link-invalid' })
  })

  it('never throws on arbitrary input', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        decodePlot(s)
        decodePlot(`plot=${s}&roads=${s}&type=condo`)
        decodePlot(`${encodePlot(plot)}&limits=${s}`)
        decodeRegion(`rules=${s}`)
      }),
    )
  })

  it('recognises the example link, with or without the leading # and beside the zone confirmation', () => {
    for (const hash of ['example', '#example', '#example&zone=confirmed']) expect(linkedExample(hash)).toEqual({ region: 'bkk', plot: EXAMPLE_PLOT })
    for (const hash of ['', '#', encodePlot(plot), '#examples']) expect(linkedExample(hash)).toBeNull()
  })

  it('opens the example of the region the link names, and Bangkok’s when that region has none or the name is broken', () => {
    expect(exampleFragment('bkk')).toBe('example')
    for (const region of ['mum', 'dxb'] as const) {
      expect(linkedExample(`#${exampleFragment(region)}`)).toEqual({ region, plot: REGIONS[region].example.plot })
      expect(linkedExample(`#example&rules=${region}`)).toEqual({ region, plot: REGIONS[region].example.plot })
    }
    for (const hash of [exampleFragment('custom'), 'rules=nowhere&example', 'rules=mum&rules=dxb&example']) {
      expect(linkedExample(hash)).toEqual({ region: 'bkk', plot: EXAMPLE_PLOT })
    }
  })

  it('gives every region’s example as a plot a link carries unchanged, so it opens the same after sharing', () => {
    for (const { id, example } of Object.values(REGIONS)) {
      if (!example) continue
      expect(decodePlot(encodePlot(example.plot))).toEqual({ ok: true, plot: example.plot })
      expect(decodeRegion(`#${exampleFragment(id)}`)).toEqual({ ok: true, region: id })
    }
  })

  it('still opens the link of the earlier Mumbai example, two 5 m lanes off Upashrey Lane', () => {
    const earlier = '#rules=mum&plot=72.84163,19.116807;72.842039,19.116807;72.8420387,19.1171984;72.84163,19.1171982&roads=0:5;3:5&type=condo'
    expect(decodeRegion(earlier)).toEqual({ ok: true, region: 'mum' })
    expect(decodePlot(earlier)).toEqual({
      ok: true,
      plot: {
        ring: [
          [72.84163, 19.116807],
          [72.842039, 19.116807],
          [72.8420387, 19.1171984],
          [72.84163, 19.1171982],
        ],
        roads: [
          { edge: 0, widthM: 5 },
          { edge: 3, widthM: 5 },
        ],
        buildingType: 'condo',
        nearStation: false,
      },
    })
  })
})

const limits = fc.record(
  {
    maxGfaSqm: fc.double({ min: 1, max: ASSUMPTIONS.plotMaxGfaSqm.value, noNaN: true }),
    maxFar: fc.double({ min: 0.1, max: ASSUMPTIONS.plotMaxFar.value, noNaN: true }),
    maxHeightM: fc.double({ min: 1, max: ASSUMPTIONS.plotMaxHeightM.value, noNaN: true }),
    maxStoreys: fc.integer({ min: 1, max: ASSUMPTIONS.plotMaxStoreys.value }),
    maxCoverageShare: fc.double({ min: 0.01, max: 1, noNaN: true }),
    roadSetbackM: fc.double({ min: 0, max: ASSUMPTIONS.plotMaxSetbackM.value, noNaN: true }),
    boundarySetbackM: fc.double({ min: 0, max: ASSUMPTIONS.plotMaxSetbackM.value, noNaN: true }),
    minOpenSpaceShare: fc.double({ min: 0, max: 0.99, noNaN: true }),
    parkingSqmPerSpace: fc.double({ min: 1, max: ASSUMPTIONS.plotMaxParkingSqmPerSpace.value, noNaN: true }),
  },
  { requiredKeys: [] },
)

describe('plot limits in the link', () => {
  const entered: Plot = { ...plot, limits: { maxGfaSqm: 5000, maxStoreys: 10, maxCoverageShare: 0.6 } }

  it('adds the entered limits only when there are some, so links made before them still open', () => {
    expect(encodePlot(entered)).toBe(`${encodePlot(plot)}&limits=maxGfaSqm:5000;maxStoreys:10;maxCoverageShare:0.6`)
    expect(encodePlot({ ...plot, limits: {} })).toBe(encodePlot(plot))
    expect(decodePlot(encodePlot(plot))).toEqual({ ok: true, plot })
  })

  it('round-trips any entered limits exactly', () => {
    fc.assert(
      fc.property(plots, limits, (p, entered) => {
        const withLimits = Object.keys(entered).length === 0 ? p : { ...p, limits: entered }
        expect(decodePlot(encodePlot(withLimits))).toEqual({ ok: true, plot: withLimits })
      }),
    )
  })

  it('says a link is invalid when a limit is unknown or malformed', () => {
    const good = encodePlot(plot)
    const broken = ['castle:3', 'maxGfaSqm', 'maxGfaSqm:', 'maxGfaSqm:abc', 'maxGfaSqm:1;maxGfaSqm:2', '']
    for (const value of broken) expect(decodePlot(`${good}&limits=${value}`)).toEqual({ ok: false, problem: 'link-invalid' })
  })

  it('refuses limits out of range for a real plot, apart from a broken link', () => {
    const good = encodePlot(plot)
    const outOfRange = ['maxGfaSqm:-5', 'maxStoreys:2.5', 'maxCoverageShare:1.5', 'maxFar:100;maxHeightM:1000000', `maxStoreys:${ASSUMPTIONS.plotMaxStoreys.value + 1}`]
    for (const value of outOfRange) expect(decodePlot(`${good}&limits=${value}`)).toEqual({ ok: false, problem: 'link-limits' })
  })

  it('refuses a link that gives the limits twice, as it refuses two rules sources', () => {
    expect(decodePlot(`${encodePlot(plot)}&limits=maxFar:3&limits=maxFar:30`)).toEqual({ ok: false, problem: 'link-invalid' })
  })
})

describe('prescribed road widths in the link', () => {
  const widened: Plot = { ...plot, roads: [{ edge: 0, widthM: 9, prescribedWidthM: 18.3 }, { edge: 3, widthM: 6.5 }] }

  it('writes a prescribed width after the road width, and old links without one still open', () => {
    expect(encodePlot(widened)).toContain('roads=0:9:18.3;3:6.5')
    expect(decodePlot(encodePlot(plot))).toEqual({ ok: true, plot })
  })

  it('round-trips any prescribed width wider than its road', () => {
    fc.assert(
      fc.property(fc.double({ min: 1, max: 100, noNaN: true }), fc.double({ min: 0.01, max: 100, noNaN: true }), (widthM, extraM) => {
        const one: Plot = { ...plot, roads: [{ edge: 0, widthM, prescribedWidthM: widthM + extraM }] }
        expect(decodePlot(encodePlot(one))).toEqual({ ok: true, plot: one })
      }),
    )
  })

  it('says a link is invalid when a prescribed width does not widen the road or a road has extra parts', () => {
    for (const roads of ['0:9:9', '0:9:6', '0:9:', '0:9:abc', '0:9:18:20', '0:9:999'])
      expect(decodePlot(encodePlot(plot).replace(/roads=[^&]*/, `roads=${roads}`))).toEqual({ ok: false, problem: 'link-invalid' })
  })
})

describe('rules source in the link', () => {
  it('leaves Bangkok out, so every link made before regions existed opens as Bangkok', () => {
    expect(encodeRegion('bkk')).toBe('')
    expect(decodeRegion(encodePlot(plot))).toEqual({ ok: true, region: 'bkk' })
    expect(decodeRegion('')).toEqual({ ok: true, region: 'bkk' })
  })

  it('names Dubai, Mumbai and custom rules', () => {
    expect(encodeRegion('dxb')).toBe('rules=dxb')
    expect(encodeRegion('mum')).toBe('rules=mum')
    expect(encodeRegion('custom')).toBe('rules=custom')
    for (const id of ['dxb', 'mum', 'custom'] as const) expect(decodeRegion(`#${encodePlot(plot)}&${encodeRegion(id)}`)).toEqual({ ok: true, region: id })
  })

  it('refuses a rules source it does not know', () => {
    for (const hash of ['rules=', 'rules=mumbai', 'rules=BKK', 'rules=dxb&rules=custom']) {
      expect(decodeRegion(hash)).toEqual({ ok: false, problem: 'link-invalid' })
    }
  })
})
