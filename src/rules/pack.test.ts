import { describe, expect, it } from 'bun:test'
import { compilePack } from '../../tools/compile-pack'
import { lineAt, readSource } from '../../tools/pages'
import { loadPack, PACK_IDS } from '.'
import type { Cite } from './types'

const ROOT = `${import.meta.dir}/../..`

function cites(node: unknown): Cite[] {
  if (Array.isArray(node)) return node.flatMap(cites)
  if (node === null || typeof node !== 'object') return []
  if ('quote' in node && 'page' in node) return [node as Cite]
  return Object.values(node).flatMap(cites)
}

describe.each(PACK_IDS)('pack %s', (id) => {
  const pack = loadPack(id)

  it('is exactly what the compiler produces from its pointer file', async () => {
    const pointers = await Bun.file(`${ROOT}/pointers/${id}.json`).json()
    const sources = Object.fromEntries(await Promise.all(Object.keys(pack.sources).map(async (s) => [s, await readSource(s)] as const)))
    expect(compilePack(pointers, sources)).toEqual({ ok: true, value: pack })
  })

  it('quotes every cite verbatim from its page and line', async () => {
    for (const cite of cites(pack)) {
      expect(lineAt(await readSource(cite.source), cite.page, cite.line)?.trim()).toBe(cite.quote)
    }
  })
})

describe('bkk-y9 golden values, read by hand from the gazette PDFs', () => {
  const pack = loadPack('bkk-y9')

  it('caps FAR at 7:1 with open space of 4.5% of floor area, half of it permeable', () => {
    expect(pack.far.max.value).toBe(7)
    expect(pack.openSpaceRatio.minShareOfFloorArea.value).toBeCloseTo(0.045, 12)
    expect(pack.openSpaceRatio.permeableShareOfOpenSpace.value).toBe(0.5)
  })

  it('limits the FAR bonus to 20% in total', () => {
    expect(pack.farBonus.combinedMaxShare.value).toBe(0.2)
    expect(pack.farBonus.measures.map((m) => m.kind)).toEqual(['affordableHousing', 'publicOpenSpace', 'publicParking', 'floodRetention', 'energyRating'])
  })

  it('restricts hotels above 80 rooms and offices above 10,000 m² to wide roads or station catchments, and does not list condos', () => {
    expect(pack.useConditions.hotel).toMatchObject({
      kind: 'restrictedAbove',
      threshold: { value: 80, cmp: 'gt' },
      unlessRoadWidthM: { value: 12, cmp: 'gte' },
      unlessStationDistanceM: { value: 500, cmp: 'lte' },
    })
    expect(pack.useConditions.office).toMatchObject({
      kind: 'restrictedAbove',
      threshold: { value: 10000, cmp: 'gt' },
      unlessRoadWidthM: { value: 16, cmp: 'gte' },
    })
    expect(pack.useConditions.condo.kind).toBe('notListed')
  })

  it('classifies high-rise from 23 m and extra-large from 10,000 m²', () => {
    expect(pack.buildingClasses.highRiseFromHeightM).toMatchObject({ value: 23, cmp: 'gte' })
    expect(pack.buildingClasses.extraLargeFromFloorAreaSqm).toMatchObject({ value: 10000, cmp: 'gte' })
  })

  it('sets walls with openings 2 m back up to 9 m, 3 m below 23 m, and high-rise 6 m', () => {
    const [openings] = pack.boundarySetbacks
    expect(openings.bands.map((b) => b.distanceM.value)).toEqual([2, 3])
    expect(pack.boundarySetbacks.find((r) => r.scope === 'highRiseOrExtraLarge')?.bands[0].distanceM.value).toBe(6)
    expect(pack.blindWall.minDistanceM.value).toBe(0.5)
  })

  it('caps height at twice the distance to the far side of the road and steps road setbacks by width', () => {
    expect(pack.heightVsRoad.maxMultipleOfDistance.map((m) => m.value)).toEqual([2, 2])
    const setbacks = pack.roadSetbacks[0].bands.map((b) => b.setback)
    expect(setbacks).toMatchObject([
      { kind: 'fromCentreline', distanceM: { value: 6 } },
      { kind: 'fromRoadBoundaryShareOfWidth', share: { value: 0.1 } },
      { kind: 'fromRoadBoundary', distanceM: { value: 2 } },
    ])
  })

  it('needs a 10 m road (18 m above 30,000 m²) and 12 m frontage for high-rise', () => {
    expect(pack.highRise.access.map((a) => [a.roadWidthM.value, a.frontageM.value])).toEqual([
      [10, 12],
      [18, 12],
    ])
  })

  it('asks one parking space per condo unit and per 60 m² of office', () => {
    for (const rule of pack.parking) {
      expect(rule.condo).toMatchObject({ kind: 'perUnit', spacesPerUnit: { value: 1 }, unitsFromSqm: { value: 60 } })
      expect(rule.office).toMatchObject({ kind: 'perFloorArea', sqmPerSpace: { value: 60 } })
    }
  })
})
