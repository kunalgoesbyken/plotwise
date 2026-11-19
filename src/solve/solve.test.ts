import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import type { Vec2 } from '@/geo/projection'
import { convexPolygon } from '@/geometry/arbitraries'
import { totalArea, type Prism } from '@/geometry'
import { BUILDING_TYPES, type BuildingType } from '@/plot/plot'
import { loadPack } from '@/rules'
import { packInterpretations, type Interpretations } from './interpretations'
import { stationDistance } from './limits'
import { solve } from './solve'
import { plotFromMetres, rectangle } from './test-plots'

const pack = loadPack('bkk-y9')
const readings = packInterpretations(pack)
const envelopeOf = (solution: ReturnType<typeof solve>, kind: 'ordinary' | 'highRise') =>
  solution.envelopes.find((e) => e.kind === kind)

function lot(widthM: number, depthM: number, roadWidthM: number, buildingType: BuildingType = 'condo', nearStation = false) {
  return plotFromMetres(rectangle(widthM, depthM), [{ edge: 0, widthM: roadWidthM }], buildingType, nearStation)
}

const nearestToRoad = (prism: Prism) => Math.min(...prism.polygons.flatMap((p) => p.outer.map(([, y]) => y)))

describe('FAR and its bonus', () => {
  it('caps floor area at the zone FAR times the land area, cited to the plan', () => {
    const { limits, site } = solve(lot(40, 50, 16), pack, readings)
    expect(site.areaSqm).toBeCloseTo(2000, 0)
    expect(limits.far.maxGfaSqm).toBeCloseTo(pack.far.max.value * 2000, -1)
    expect(limits.far.cites).toContain(pack.far.max.cite)
  })

  it('lists the bonus measures a condo can use under each reading of the public-building question', () => {
    const eligible = (r: Interpretations) =>
      solve(lot(40, 50, 16, 'condo', true), pack, r).limits.farBonus.measures.filter((m) => m.eligible).map((m) => m.kind)
    expect(eligible({ ...readings, 'condo-public-building': 'not-public' })).toEqual(['affordableHousing', 'floodRetention', 'energyRating'])
    expect(eligible({ ...readings, 'condo-public-building': 'public' })).toContain('publicOpenSpace')
    expect(eligible({ ...readings, 'condo-public-building': 'public' })).toContain('publicParking')
    const office = (r: Interpretations) => solve(lot(40, 50, 16, 'office'), pack, r).limits.farBonus.measures
    expect(office({ ...readings, 'office-public-building': 'public' }).find((m) => m.kind === 'publicOpenSpace')?.eligible).toBe(true)
    expect(office({ ...readings, 'office-public-building': 'not-public' }).find((m) => m.kind === 'publicOpenSpace')?.eligible).toBe(false)
  })

  it('never lets the combined bonus pass the plan cap', () => {
    const { farBonus, far } = solve(lot(40, 50, 16, 'hotel', true), pack, readings).limits
    expect(farBonus.maxShare).toBeLessThanOrEqual(pack.farBonus.combinedMaxShare.value)
    expect(farBonus.maxGfaSqm).toBeCloseTo(far.maxGfaSqm * (1 + farBonus.maxShare), 6)
  })
})

describe('open space limits under each reading', () => {
  it('applies the bylaw share of land only when the stricter reading is chosen', () => {
    const sources = (r: Interpretations) =>
      new Set(solve(lot(40, 50, 16), pack, r).limits.openSpace.minimums.map((m) => m.cites[0].source))
    expect(sources({ ...readings, 'open-space-base': 'all-stricter' })).toContain('bb44-03')
    expect(sources({ ...readings, 'open-space-base': 'ministerial-only' })).not.toContain('bb44-03')
  })

  it('gives a hotel the residential 30 per cent or the non-residential 10 per cent depending on the reading', () => {
    const shares = (r: Interpretations) => solve(lot(40, 50, 16, 'hotel'), pack, r).limits.openSpace.minimums.map((m) => m.share)
    expect(new Set(shares({ ...readings, 'hotel-residential': 'residential' }))).toEqual(new Set([0.3]))
    expect(new Set(shares({ ...readings, 'hotel-residential': 'public-building' }))).toEqual(new Set([0.1]))
  })

  it('records which open space the permeable half is measured against', () => {
    expect(solve(lot(40, 50, 16), pack, { ...readings, 'permeable-base': 'provided' }).limits.openSpace.permeable.base).toBe('provided')
    expect(solve(lot(40, 50, 16), pack, { ...readings, 'permeable-base': 'required' }).limits.openSpace.permeable.base).toBe('required')
  })
})

describe('use conditions', () => {
  it('permits a condo of any size in this zone', () => {
    expect(solve(lot(40, 50, 8), pack, readings).limits.use.kind).toBe('permitted')
  })

  it('exempts a large hotel on a wide enough road with enough frontage, or near a station', () => {
    const use = (p: ReturnType<typeof lot>, r = readings) => solve(p, pack, r).limits.use
    expect(use(lot(40, 50, 12, 'hotel'))).toMatchObject({ kind: 'restricted', exemption: { kind: 'road', edge: 0 } })
    expect(use(lot(40, 50, 10, 'hotel'))).toMatchObject({ exemption: { kind: 'none' } })
    expect(use(lot(40, 50, 10, 'hotel', true))).toMatchObject({ exemption: { kind: 'station' } })
  })

  it('needs the tier frontage on that road only under the frontage reading', () => {
    const narrow = lot(10, 50, 12, 'hotel')
    expect(solve(narrow, pack, { ...readings, 'road-access-tiers': 'frontage-and-row' }).limits.use).toMatchObject({ exemption: { kind: 'none' } })
    expect(solve(narrow, pack, { ...readings, 'road-access-tiers': 'row-only' }).limits.use).toMatchObject({ exemption: { kind: 'road' } })
  })

  it('reads the office condition from the pack, with its own road width', () => {
    const use = solve(lot(40, 50, 12, 'office'), pack, readings).limits.use
    expect(use).toMatchObject({ kind: 'restricted', measure: 'operatingAreaSqm', exemption: { kind: 'none' } })
    expect(solve(lot(40, 50, 16, 'office'), pack, readings).limits.use).toMatchObject({ exemption: { kind: 'road' } })
  })

  it('shares one station distance across every use that names one', () => {
    const named = BUILDING_TYPES.map((t) => pack.useConditions[t]).flatMap((c) => (c.kind === 'restrictedAbove' ? [c.unlessStationDistanceM.value] : []))
    expect(new Set(named)).toEqual(new Set([stationDistance(pack).value]))
  })
})

describe('parking source', () => {
  it('selects the bylaw, the ministerial rule or both', () => {
    const scopes = (reading: Interpretations['parking-source']) =>
      solve(lot(40, 50, 16), pack, { ...readings, 'parking-source': reading }).limits.parking.rules.map((r) => r.scope)
    expect(scopes('bylaw')).toEqual(['bangkokBylaw'])
    expect(scopes('ministerial')).toEqual(['ministerialInnerBangkok'])
    expect(scopes('higher-of-both')).toEqual(['bangkokBylaw', 'ministerialInnerBangkok'])
  })
})

describe('the allowed envelope', () => {
  it('offers a high-rise envelope only where the road and frontage allow one', () => {
    expect(solve(lot(40, 50, 8), pack, readings).envelopes.map((e) => e.kind)).toEqual(['ordinary'])
    expect(solve(lot(40, 50, 10), pack, readings).envelopes.map((e) => e.kind)).toEqual(['ordinary', 'highRise'])
    expect(solve(lot(11, 50, 30), pack, readings).envelopes.map((e) => e.kind)).toEqual(['ordinary'])
  })

  it('keeps an ordinary building below the high-rise height', () => {
    const ordinary = envelopeOf(solve(lot(40, 50, 16), pack, readings), 'ordinary')
    expect(ordinary?.prisms.at(-1)?.topM).toBeLessThan(pack.buildingClasses.highRiseFromHeightM.value)
  })

  it('steps back from the road as it rises, never closer than twice the height rule allows', () => {
    const solution = solve(lot(40, 60, 12), pack, readings)
    const highRise = envelopeOf(solution, 'highRise')!
    const areas = highRise.prisms.map((p) => totalArea(p.polygons))
    expect(areas.length).toBeGreaterThan(2)
    areas.slice(1).forEach((area, i) => expect(area).toBeLessThanOrEqual(areas[i] + 1e-6))
    expect(areas.at(-1)!).toBeLessThan(areas[0])
    for (const prism of highRise.prisms) expect(nearestToRoad(prism)).toBeGreaterThanOrEqual(prism.topM / 2 - 12 - 1e-3)
  })

  it('keeps 6 m from every boundary for a high-rise and 3 m from neighbours for an ordinary building', () => {
    const solution = solve(lot(40, 60, 30), pack, readings)
    const sideClearance = (kind: 'ordinary' | 'highRise') =>
      Math.min(...envelopeOf(solution, kind)!.prisms[0].polygons.flatMap((p) => p.outer.map(([x]) => x)))
    expect(sideClearance('highRise')).toBeCloseTo(6, 2)
    expect(sideClearance('ordinary')).toBeCloseTo(3, 2)
  })

  it('cites the rules behind every non-zero setback', () => {
    for (const env of solve(lot(40, 60, 12, 'hotel'), pack, readings).envelopes) {
      for (const tier of env.tiers) for (const s of tier.setbacks) if (s.distanceM > 0) expect(s.cites.length).toBeGreaterThan(0)
    }
  })

  it('reserves the front open space along the main road only under the always reading', () => {
    const front = (reading: Interpretations['front-open-space']) =>
      envelopeOf(solve(lot(40, 60, 30), pack, { ...readings, 'front-open-space': reading }), 'ordinary')!.tiers[0].setbacks[0].distanceM
    expect(front('always')).toBe(12)
    expect(front('exempt-on-road')).toBe(2)
  })

  it('a wider road lets the envelope rise further before it steps back', () => {
    const firstStep = (roadWidthM: number) => envelopeOf(solve(lot(40, 60, roadWidthM), pack, readings), 'highRise')!.tiers[0].toM
    expect(firstStep(30)).toBeGreaterThan(firstStep(12))
  })

  it('changing the building type changes the storey height and the use condition', () => {
    const condo = solve(lot(40, 60, 12), pack, readings)
    const office = solve(lot(40, 60, 12, 'office'), pack, readings)
    expect(office.floorToFloorM).toBeGreaterThan(condo.floorToFloorM)
    expect([condo.limits.use.kind, office.limits.use.kind]).toEqual(['permitted', 'restricted'])
  })

  it('nests each prism inside the one below, on any convex plot and road width', () => {
    fc.assert(
      fc.property(convexPolygon(10), fc.double({ min: 4, max: 40, noNaN: true }), (points: Vec2[], roadWidthM) => {
        const solution = solve(plotFromMetres(points, [{ edge: 0, widthM: roadWidthM }]), pack, readings)
        for (const env of solution.envelopes) {
          const areas = env.prisms.map((p) => totalArea(p.polygons))
          areas.slice(1).forEach((area, i) => expect(area).toBeLessThanOrEqual(areas[i] + 1e-6))
          env.prisms.slice(1).forEach((p, i) => expect(p.baseM).toBeCloseTo(env.prisms[i].topM, 9))
        }
      }),
      { numRuns: 40 },
    )
  })
})
