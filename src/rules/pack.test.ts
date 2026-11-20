import { describe, expect, it } from 'bun:test'
import { compilePack } from '../../tools/compile-pack'
import { lineAt, readSource } from '../../tools/pages'
import { loadPack, PACK_IDS } from '.'
import type { Range, SourceCite } from './cite'
import { zoneFar } from './zone-far'

const ROOT = `${import.meta.dir}/../..`

function cites(node: unknown): SourceCite[] {
  if (Array.isArray(node)) return node.flatMap(cites)
  if (node === null || typeof node !== 'object') return []
  if ('quote' in node && 'page' in node) return [node as SourceCite]
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
    expect(zoneFar(pack).max.value).toBe(7)
    expect(pack.openSpaceRatio!.minShareOfFloorArea.value).toBeCloseTo(0.045, 12)
    expect(pack.openSpaceRatio!.permeableShareOfOpenSpace.value).toBe(0.5)
  })

  it('limits the FAR bonus to 20% in total', () => {
    expect(pack.farBonus!.combinedMaxShare.value).toBe(0.2)
    expect(pack.farBonus!.measures.map((m) => m.kind)).toEqual(['affordableHousing', 'publicOpenSpace', 'publicParking', 'floodRetention', 'energyRating'])
  })

  it('restricts hotels above 80 rooms and offices above 10,000 m² to wide roads or station catchments, and does not list condos', () => {
    expect(pack.useConditions!.hotel).toMatchObject({
      kind: 'restrictedAbove',
      threshold: { value: 80, cmp: 'gt' },
      unlessRoadWidthM: { value: 12, cmp: 'gte' },
      unlessStationDistanceM: { value: 500, cmp: 'lte' },
    })
    expect(pack.useConditions!.office).toMatchObject({
      kind: 'restrictedAbove',
      threshold: { value: 10000, cmp: 'gt' },
      unlessRoadWidthM: { value: 16, cmp: 'gte' },
    })
    expect(pack.useConditions!.condo.kind).toBe('notListed')
  })

  it('classifies high-rise from 23 m and extra-large from 10,000 m²', () => {
    expect(pack.buildingClasses!.highRiseFromHeightM).toMatchObject({ value: 23, cmp: 'gte' })
    expect(pack.buildingClasses!.extraLargeFromFloorAreaSqm).toMatchObject({ value: 10000, cmp: 'gte' })
  })

  it('sets walls with openings 2 m back up to 9 m, 3 m below 23 m, and high-rise 6 m', () => {
    const [openings] = pack.boundarySetbacks
    expect(openings.bands.map((b) => b.distanceM.value)).toEqual([2, 3])
    expect(pack.boundarySetbacks.find((r) => r.scope === 'highRiseOrExtraLarge')?.bands[0].distanceM.value).toBe(6)
    expect(pack.blindWall!.minDistanceM.value).toBe(0.5)
  })

  it('caps height at twice the distance to the far side of the road and steps road setbacks by width', () => {
    expect(pack.height.roadMultiple!.maxMultipleOfDistance.map((m) => m.value)).toEqual([2, 2])
    const setbacks = pack.roadSetbacks[0].bands.map((b) => b.setback)
    expect(setbacks).toMatchObject([
      { kind: 'fromCentreline', distanceM: { value: 6 } },
      { kind: 'fromRoadBoundaryShareOfWidth', share: { value: 0.1 } },
      { kind: 'fromRoadBoundary', distanceM: { value: 2 } },
    ])
  })

  it('needs a 10 m road (18 m above 30,000 m²) and 12 m frontage for high-rise', () => {
    expect(pack.highRise!.access.map((a) => [a.roadWidthM.value, a.frontageM.value])).toEqual([
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

describe('mum-suburbs-res draft values, read by hand from DCPR 2034 as sanctioned in 2018', () => {
  const pack = loadPack('mum-suburbs-res')
  const edges = ({ min, max }: Range) => [min && `${min.cmp} ${min.value}`, max && `${max.cmp} ${max.value}`]
  const extras = (kind: string) => {
    const cap = pack.farPurchases!.find((p) => p.kind === kind)!.cap
    return cap.kind === 'extraRatioByRoadWidth' ? cap.bands.map((b) => (b.kind === 'ratio' ? b.ratio.value : 0)) : []
  }

  it('is a draft that never shows as verified and covers residential buildings only', () => {
    expect(pack.verification).toBe('unverified')
    expect(pack.buildingTypes).toEqual(['condo'])
    expect(pack.coverage).toBeUndefined()
  })

  it('reads Table 12: basic FSI 1.0 on every road, premium and TDR by road width, adding up to the permissible column', () => {
    if (pack.far.kind !== 'byRoadWidthAndPlotSize') throw new Error('Table 12 is by road width')
    const bands = pack.far.roadWidthBands
    expect(bands.map((b) => edges(b.roadWidthM))).toEqual([
      [undefined, 'lt 9'],
      ['gte 9', 'lt 12'],
      ['gte 12', 'lt 18'],
      ['gte 18', 'lt 27'],
      ['gte 27', undefined],
    ])
    expect(bands.map((b) => b.byPlotSize.map((row) => row.ratio.value))).toEqual([[1], [1], [1], [1], [1]])
    expect(extras('premium')).toEqual([0, 0.5, 0.5, 0.5, 0.5])
    expect(extras('transferableRights')).toEqual([0, 0.5, 0.7, 0.9, 1])
    expect(bands.map((b) => b.permissible?.value)).toEqual([1, 2, 2.2, 2.4, 2.5])
  })

  it('prices premium FSI at 50% of the ASR land rate, leaves TDR to the market and allows 35% fungible on the permissible total', () => {
    expect(pack.farPurchases!.map((p) => [p.kind, p.price.kind === 'shareOfLandRate' ? p.price.share.value : p.price.kind])).toEqual([
      ['premium', 0.5],
      ['transferableRights', 'userSupplied'],
      ['fungible', 0.5],
    ])
    expect(pack.farPurchases![2].cap).toMatchObject({ kind: 'shareOf', of: 'permissible', share: { value: 0.35 } })
  })

  it('sets 4.5 m front open space, 6 m on roads wider than 52 m, and height at three times the street plus that space', () => {
    expect(pack.roadSetbacks[0].bands.map((b) => [edges(b.roadWidthM), b.setback.kind === 'fromRoadBoundary' && b.setback.distanceM.value])).toEqual([
      [[undefined, 'lte 52'], 4.5],
      [['gt 52', undefined], 6],
    ])
    expect(pack.height.roadMultiple).toMatchObject({ distance: 'streetPlusFrontSpace', maxMultipleOfDistance: [{ value: 3 }] })
    expect(pack.height.planLimit.kind).toBe('none')
  })

  it('relaxes open spaces for ground and one upper floor on plots of 21 m² to under 250 m² (Table No 17)', () => {
    const rows = pack.lowRiseOpenSpaces!.rows
    expect(pack.lowRiseOpenSpaces!.maxUpperFloors.value).toBe(1)
    expect(rows.map((r) => [...edges(r.plotAreaSqm), r.frontM.value, r.rearM.value, r.sideM?.value])).toEqual([
      ['gte 21', 'lt 30', 0.75, 1.5, undefined],
      ['gte 30', 'lt 40', 0.75, 2.25, undefined],
      ['gte 40', 'lt 60', 1, 2.25, 1],
      ['gte 60', 'lt 125', 1.5, 3, 1],
      ['gte 125', 'lt 250', 3, 3, 1.5],
    ])
  })

  it('takes side and rear open spaces per plot, FSI on the plot left after widening and twice the handed-over land in lieu', () => {
    expect(pack.plotSetbacks).toMatchObject({ kind: 'plotSpecific', edges: 'boundary' })
    expect(pack.reservations).toMatchObject([{ target: { kind: 'perFrontage' }, farOn: 'net', inLieu: { multipleOfReserved: { value: 2 } } }])
  })

  it('asks one space per 4, 2, 1 or half a tenement by carpet area, plus 25% for visitors and at least one (Table No 21)', () => {
    const [rule] = pack.parking
    if (rule.condo?.kind !== 'unitsPerSpaceBySize') throw new Error('Table No 21 counts tenements per space')
    expect(rule.condo.bands.map((b) => [...edges(b.unitSqm), b.unitsPerSpace.value])).toEqual([
      [undefined, 'lte 45', 4],
      ['gt 45', 'lte 60', 2],
      ['gt 60', 'lte 90', 1],
      ['gt 90', undefined, 0.5],
    ])
    expect(rule.visitors).toMatchObject({ share: { value: 0.25 }, min: { value: 1 } })
    expect(rule.fractionsAboveHalfRoundUp).toBeDefined()
  })
})
