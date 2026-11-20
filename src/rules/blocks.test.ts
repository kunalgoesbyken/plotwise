import { describe, expect, it } from 'bun:test'
import { bandGaps, bandsCoverEverything } from './bands'
import { RulePackSchema } from './pack'
import { band, BANGKOK, PER_PLOT, value } from './test-packs'

const table = (roadBands: readonly { roadWidthM: ReturnType<typeof band>; sizes: readonly ReturnType<typeof band>[] }[]) => ({
  kind: 'byRoadWidthAndPlotSize',
  roadWidthBands: roadBands.map(({ roadWidthM, sizes }) => ({ roadWidthM, byPlotSize: sizes.map((plotAreaSqm) => ({ plotAreaSqm, ratio: value(2) })) })),
  notes: [],
})

const withFar = (far: unknown) => RulePackSchema.safeParse({ ...BANGKOK, verification: 'unverified', far })

describe('bands', () => {
  it('accepts bands that run from 0 to unlimited with each one starting where the last stops', () => {
    expect(bandsCoverEverything([band(undefined, 12), band(12, 30), band(30)])).toBe(true)
  })

  it('names a gap, an overlap, a missing start and an end that is not open', () => {
    expect(bandGaps([band(undefined, 12), band(13)])).toEqual(['has a gap or overlap between bands 0 and 1'])
    expect(bandGaps([band(6, 12), band(12)])).toEqual(['does not start at 0'])
    expect(bandsCoverEverything([band(undefined, 12), band(12, 30)])).toBe(false)
  })
})

describe('FAR from a road width × plot size table', () => {
  it('accepts a table that covers every road width and plot size', () => {
    const far = table([
      { roadWidthM: band(undefined, 12), sizes: [band(undefined, 1000), band(1000)] },
      { roadWidthM: band(12), sizes: [band()] },
    ])
    expect(withFar(far).success).toBe(true)
  })

  it('rejects a gap between road widths', () => {
    const far = table([
      { roadWidthM: band(undefined, 12), sizes: [band()] },
      { roadWidthM: band(18), sizes: [band()] },
    ])
    expect(withFar(far).success).toBe(false)
  })

  it('rejects plot sizes that stop short of unlimited', () => {
    const far = table([{ roadWidthM: band(), sizes: [band(undefined, 1000)] }])
    expect(withFar(far).success).toBe(false)
  })
})

describe('the rule pack', () => {
  it('accepts a pack that sets every limit per plot and has none of the optional rules', () => {
    expect(PER_PLOT.far.kind).toBe('plotSpecific')
  })

  it('refuses a verified pack that holds a value entered by a user', () => {
    const result = RulePackSchema.safeParse({ ...BANGKOK, far: { kind: 'zone', max: value(7), notes: [] } })
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([['verification']])
  })

  it('refuses high-rise rules without the building classes that define a high-rise', () => {
    const result = RulePackSchema.safeParse({ ...BANGKOK, buildingClasses: undefined })
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([['highRise']])
  })

  it('keeps Bangkok verified', () => {
    expect(BANGKOK.verification).toBe('verified')
  })
})
