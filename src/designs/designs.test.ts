import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import type { Vec2 } from '@/geo/projection'
import { convexPolygon, starPolygon } from '@/geometry/arbitraries'
import { intersection } from '@/geometry/clip'
import { segmentDistance, totalArea } from '@/geometry'
import type { BuildingType, Plot, PlotLimits } from '@/plot/plot'
import { loadPack, type PackId } from '@/rules'
import { zoneFar } from '@/rules/zone-far'
import {
  buildingControlOpenSpace,
  isHighRiseOrExtraLarge,
  packInterpretations,
  ratioOpenSpace,
  satisfies,
  sideRearOpenSpace,
  solve,
  type Interpretations,
  type Solution,
} from '@/solve'
import { plotFromMetres, rectangle } from '@/solve/test-plots'
import { EXAMPLE_PLOT } from '@/plot/example-plot'
import { SQM_PER_SQFT } from '@/units/area'
import { designs, type Design } from './designs'
import { headline } from './headline'
import { TYPOLOGIES } from './massing'
import { AREA_TOLERANCE_SQM } from './tolerance'

const pack = loadPack('bkk-y9')
const readings = packInterpretations(pack)

function lot(widthM: number, depthM: number, roadWidthM: number, buildingType: BuildingType = 'condo', nearStation = false) {
  return plotFromMetres(rectangle(widthM, depthM), [{ edge: 0, widthM: roadWidthM }], buildingType, nearStation)
}

const designed = (plot: ReturnType<typeof lot>, r: Interpretations = readings) => {
  const solution = solve(plot, pack, r)
  return { solution, options: designs(solution) }
}

const byId = (options: readonly Design[], id: Design['id']) => options.find((d) => d.id === id)
const computed = (d: Design) => d.checks.filter((c) => c.status !== 'manual')

function assertInsideEnvelope(solution: ReturnType<typeof solve>, design: Design) {
  const envelope = solution.envelopes.find((e) => e.kind === design.envelope)!
  for (const floor of design.plates.floors) {
    const prism = envelope.prisms.find((p) => p.baseM <= floor.baseM + 1e-6 && floor.topM <= p.topM + 1e-6)
    expect(prism).toBeDefined()
    const inside = totalArea(intersection(floor.polygons, prism!.polygons))
    expect(inside).toBeGreaterThanOrEqual(totalArea(floor.polygons) - 0.05)
  }
}

describe('concept designs', () => {
  it('offers a podium tower, a slab on the main road and a low-rise block on a typical plot, each named from what it became', () => {
    const { options } = designed(lot(50, 70, 16))
    expect(options.map((d) => d.id)).toEqual(['podium-tower', 'slab', 'low-rise'])
    expect(options.map((d) => d.name.form)).toEqual(['podium-tower', 'slab', 'block'])
    for (const d of options) expect(d.name.storeys).toBe(d.metrics.storeys)
  })

  it('still offers two designs where a high-rise is not allowed', () => {
    const { options } = designed(lot(30, 40, 8))
    expect(options.map((d) => d.id)).toEqual(['slab', 'low-rise'])
    expect(options.every((d) => d.envelope === 'ordinary')).toBe(true)
  })

  it('aims at the floor area limit and passes every computed check on a typical plot', () => {
    const { solution, options } = designed(lot(50, 70, 16))
    const tower = byId(options, 'podium-tower')!
    expect(tower.metrics.gfaSqm).toBeGreaterThan(0.9 * solution.limits.far.maxGfaSqm)
    for (const d of options) expect(computed(d).filter((c) => c.status === 'fail')).toEqual([])
  })

  it('keeps the low-rise block under the high-rise height and the extra-large floor area', () => {
    const { options } = designed(lot(50, 70, 16))
    const low = byId(options, 'low-rise')!
    expect(isHighRiseOrExtraLarge(pack, { heightM: low.metrics.heightM, storeys: low.metrics.storeys, floorAreaSqm: low.metrics.builtSqm })).toBe(false)
  })

  it('fills the ground of an envelope too small for the floor area target, instead of a block sized for storeys it cannot use', () => {
    const lShape: Vec2[] = [
      [0, 0],
      [60, 0],
      [60, 25],
      [25, 25],
      [25, 60],
      [0, 60],
    ]
    const { solution, options } = designed(plotFromMetres(lShape, [{ edge: 0, widthM: 12 }], 'office'))
    const [ground] = solution.envelopes.find((e) => e.kind === 'ordinary')!.prisms
    expect(byId(options, 'low-rise')!.plates.floors[0].areaSqm).toBeCloseTo(totalArea(ground.polygons), 1)
  })

  it('adds the network part of the high-rise access rule as a manual check', () => {
    const tower = byId(designed(lot(50, 70, 16)).options, 'podium-tower')!
    expect(tower.checks.find((c) => c.id === 'high-rise-road-network')?.status).toBe('manual')
  })

  it('cites a source for every check', () => {
    for (const d of designed(lot(50, 70, 16, 'hotel')).options) for (const c of d.checks) expect(c.cites.length).toBeGreaterThan(0)
  })
})

describe('designs follow the rules as inputs change', () => {
  it('keeps a hotel to the room limit on a narrow road, and lifts it near a station', () => {
    const rooms = (nearStation: boolean) =>
      designed(lot(50, 70, 10, 'hotel', nearStation)).options.map((d) => (d.metrics.yield.kind === 'rooms' ? d.metrics.yield.count : 0))
    expect(Math.max(...rooms(false))).toBeLessThanOrEqual(80)
    expect(Math.max(...rooms(true))).toBeGreaterThan(80)
  })

  it('marks a station exemption as a manual check', () => {
    const { options } = designed(lot(50, 70, 10, 'hotel', true))
    expect(options.some((d) => d.checks.some((c) => c.id === 'use-station' && c.status === 'manual'))).toBe(true)
  })

  it('caps an office on a road under 16 m by total or net floor area depending on the reading', () => {
    const built = (reading: Interpretations['office-operating-area']) =>
      byId(designed(lot(60, 80, 12, 'office'), { ...readings, 'office-operating-area': reading }).options, 'slab')!.metrics.builtSqm
    expect(built('gfa')).toBeLessThanOrEqual(10000)
    expect(built('net')).toBeGreaterThan(10000)
  })

  it('leaves parking out of the counted floor area only under the excluded reading', () => {
    const tower = (reading: Interpretations['gfa-includes-parking']) =>
      byId(designed(lot(50, 70, 16), { ...readings, 'gfa-includes-parking': reading }).options, 'podium-tower')!.metrics
    expect(tower('counts').gfaSqm).toBe(tower('counts').builtSqm)
    expect(tower('excluded').gfaSqm).toBeCloseTo(tower('excluded').builtSqm - tower('excluded').parkingSqm, 6)
    expect(tower('excluded').builtSqm).toBeGreaterThan(tower('counts').builtSqm)
  })

  it('needs three times the building-control open space when a hotel is read as residential', () => {
    const minimum = (reading: Interpretations['hotel-residential']) => {
      const low = byId(designed(lot(50, 70, 16, 'hotel'), { ...readings, 'hotel-residential': reading }).options, 'low-rise')!
      const check = low.checks.find((c) => c.id === 'open-space-minimum')
      return check && 'limit' in check ? check.limit : NaN
    }
    expect(minimum('residential')).toBeCloseTo(3 * minimum('public-building'), 6)
  })

  it('counts more hotel parking when both parking rules apply', () => {
    const spaces = (reading: Interpretations['parking-source']) =>
      byId(designed(lot(50, 70, 16, 'hotel'), { ...readings, 'parking-source': reading }).options, 'low-rise')!.metrics.parkingSpaces
    expect(spaces('higher-of-both')).toBeGreaterThanOrEqual(Math.max(spaces('bylaw'), spaces('ministerial')))
  })

  it('measures the permeable half against required or provided open space', () => {
    const limit = (reading: Interpretations['permeable-base']) =>
      byId(designed(lot(50, 70, 16), { ...readings, 'permeable-base': reading }).options, 'podium-tower')!.checks.find(
        (c) => c.id === 'permeable',
      )
    const required = limit('required')
    const provided = limit('provided')
    expect(required && provided && 'limit' in required && 'limit' in provided && provided.limit > required.limit).toBe(true)
  })

  it('pulls the slab back for a front open space only under the always reading', () => {
    const front = (reading: Interpretations['front-open-space']) =>
      byId(designed(lot(50, 70, 30), { ...readings, 'front-open-space': reading }).options, 'low-rise')!.checks.find((c) => c.id === 'front-open-space')
    expect(front('always')).toMatchObject({ status: 'pass', unit: 'm', limit: 12 })
    expect(front('exempt-on-road')).toMatchObject({ status: 'pass', unit: 'ratio' })
  })

  it('a wider road lets the slab stand closer to it for nearly the full floor area', () => {
    const slab = (roadWidthM: number) => byId(designed(lot(40, 70, roadWidthM)).options, 'slab')!
    const fromRoad = (d: Design) => d.checks.find((c) => c.id === 'road-setback')
    const [wide, narrow] = [slab(30), slab(10)]
    for (const d of [wide, narrow]) expect(d.metrics.far).toBeGreaterThan(0.9 * zoneFar(pack).max.value)
    expect(fromRoad(wide)).toMatchObject({ status: 'pass' })
    expect((fromRoad(wide) as { actual: number }).actual).toBeLessThan((fromRoad(narrow) as { actual: number }).actual)
  })
})

describe('podium and tower', () => {
  it.each(['condo', 'office', 'hotel'] as const)('lets a %s tower climb into the top tiers of the stepped envelope', (buildingType) => {
    const solution = solve({ ...EXAMPLE_PLOT, buildingType, nearStation: true }, pack, readings)
    const prisms = solution.envelopes.find((e) => e.kind === 'highRise')!.prisms
    const tower = byId(designs(solution), 'podium-tower')!
    expect(tower.plates.floors.at(-1)!.topM).toBeGreaterThan(prisms.at(-3)!.topM)
  })

  it('names the rule that stops each design growing', () => {
    const office = byId(designed(lot(60, 80, 12, 'office')).options, 'podium-tower')!
    const nearStation = byId(designed(lot(60, 80, 12, 'office', true)).options, 'podium-tower')!
    expect(office.limitedBy).toBe('use')
    expect(nearStation.limitedBy).not.toBe('use')
    const lowRise = byId(designed(lot(60, 80, 12)).options, 'low-rise')!
    expect(lowRise.limitedBy).toBe('building-class')
  })

  it('stops an office on a narrow soi at the zone office-size condition, not at the envelope', () => {
    const tower = byId(designed(lot(60, 80, 12, 'office')).options, 'podium-tower')!
    const nearStation = byId(designed(lot(60, 80, 12, 'office', true)).options, 'podium-tower')!
    const size = tower.checks.find((c) => c.id === 'use-size')
    expect(size?.status === 'pass' && size.actual / size.limit).toBeGreaterThan(0.95)
    expect(nearStation.metrics.gfaSqm).toBeGreaterThan(tower.metrics.gfaSqm)
  })
})

describe('design invariants on any plot', () => {
  it('every floor lies in its envelope, floor area stays within FAR, open space meets every minimum and every aimed-at rule passes', () => {
    fc.assert(
      fc.property(
        fc.oneof(convexPolygon(10), starPolygon(16)),
        fc.double({ min: 4, max: 40, noNaN: true }),
        fc.constantFrom<BuildingType>('condo', 'office', 'hotel'),
        fc.boolean(),
        (points: Vec2[], roadWidthM, buildingType, nearStation) => {
          const solution = solve(plotFromMetres(points, [{ edge: 0, widthM: roadWidthM }], buildingType, nearStation), pack, readings)
          for (const design of designs(solution)) {
            assertInsideEnvelope(solution, design)
            expect(design.checks.filter((c) => c.status === 'fail' && c.id !== 'front-open-space')).toEqual([])
            const { metrics } = design
            expect(metrics.gfaSqm).toBeLessThanOrEqual(solution.limits.far.maxGfaSqm + 1e-6)
            const building = { heightM: metrics.heightM, storeys: metrics.storeys, floorAreaSqm: metrics.builtSqm }
            const need = {
              landSqm: solution.site.areaSqm,
              farSqm: metrics.gfaSqm,
              largestFloorSqm: Math.max(...design.plates.floors.map((f) => f.areaSqm)),
              highRiseOrExtraLarge: isHighRiseOrExtraLarge(pack, building),
            }
            expect(metrics.openSpaceSqm).toBeGreaterThanOrEqual(ratioOpenSpace(solution.limits, metrics.gfaSqm).value - 0.01)
            expect(metrics.openSpaceSqm).toBeGreaterThanOrEqual(buildingControlOpenSpace(solution.limits, need).value - 0.01)
          }
        },
      ),
      { numRuns: 30 },
    )
  })
})

function designedUnder(packId: PackId, plot: Plot) {
  const regionPack = loadPack(packId)
  const solution = solve(plot, regionPack, packInterpretations(regionPack))
  return { solution, options: designs(solution) }
}

const squareOf = (areaSqm: number) => rectangle(Math.sqrt(areaSqm), Math.sqrt(areaSqm))
const MUMBAI_PLOT = plotFromMetres(squareOf(20_118 * SQM_PER_SQFT), [
  { edge: 0, widthM: 5 },
  { edge: 1, widthM: 5 },
])
const DUBAI_PLOT: Plot = { ...lot(40, 30, 12), limits: { maxFar: 3.5, maxStoreys: 9 } }

const shortOfCap = ({ farCap }: Solution, d: Design) => farCap.maxGfaSqm - d.metrics.gfaSqm
const reachesCap = (solution: Solution, d: Design) => shortOfCap(solution, d) <= AREA_TOLERANCE_SQM

function assertHonestLimit(solution: Solution, d: Design) {
  expect(shortOfCap(solution, d)).toBeGreaterThanOrEqual(-0.01)
  expect(d.limitedBy === 'far').toBe(reachesCap(solution, d))
  const { planLimitM } = solution.limits.height
  if (d.limitedBy === 'height') expect(planLimitM !== null && d.metrics.heightM + solution.floorToFloorM > planLimitM).toBe(true)
  if (d.limitedBy === 'building-class') expect(solution.pack.buildingClasses).toBeDefined()
  if (d.limitedBy === 'use') expect(solution.limits.use.kind).not.toBe('permitted')
}

function assertNamedFromResult({ pack }: Solution, d: Design) {
  const threshold = pack.buildingClasses?.highRiseFromHeightM
  expect(d.name.storeys).toBe(d.metrics.storeys)
  expect(d.name.highRise).toBe(threshold !== undefined && satisfies(d.metrics.heightM, threshold))
  if (d.name.form === 'podium-tower') expect(d.plates.floors.at(-1)!.areaSqm).toBeLessThan(d.plates.footprintSqm)
}

describe('designs reach the floor area cap when the envelope has room', () => {
  it('fills a 20,118 sq ft Mumbai plot on 5 m roads to the cap, stepping the slab’s top floor back', () => {
    const { solution, options } = designedUnder('mum-suburbs-res', MUMBAI_PLOT)
    expect(options.length).toBeGreaterThanOrEqual(2)
    for (const d of options) {
      expect(reachesCap(solution, d)).toBe(true)
      expect(d.limitedBy).toBe('far')
      expect(computed(d).filter((c) => c.status === 'fail')).toEqual([])
    }
    const slab = byId(options, 'slab')!
    const [top, below] = [slab.plates.floors.at(-1)!, slab.plates.floors.at(-2)!]
    expect(top.areaSqm).toBeLessThan(below.areaSqm)
    expect(totalArea(intersection(top.polygons, below.polygons))).toBeCloseTo(totalArea(top.polygons), 2)
  })

  it('fills a Dubai plot with FAR 3.5 and G+8 to the cap without passing G+8', () => {
    const { solution, options } = designedUnder('dxb-ap', DUBAI_PLOT)
    expect(options.length).toBeGreaterThanOrEqual(2)
    for (const d of options) {
      expect(reachesCap(solution, d)).toBe(true)
      expect(d.limitedBy).toBe('far')
      expect(d.metrics.storeys).toBeLessThanOrEqual(9)
    }
  })

  it('counts a stepped-back top floor as a full storey for height', () => {
    const slab = byId(designedUnder('mum-suburbs-res', MUMBAI_PLOT).options, 'slab')!
    expect(slab.metrics.heightM).toBeCloseTo(slab.metrics.storeys * slab.plates.floors[0].topM, 9)
  })

  it('either reaches the cap or names the limit that stopped it first, for any plot and entered limits', () => {
    const entered = fc.record<PlotLimits>({
      maxFar: fc.double({ min: 0.2, max: 8, noNaN: true }),
      maxStoreys: fc.integer({ min: 1, max: 40 }),
      maxCoverageShare: fc.option(fc.double({ min: 0.2, max: 1, noNaN: true }), { nil: undefined }),
      boundarySetbackM: fc.option(fc.double({ min: 0, max: 6, noNaN: true }), { nil: undefined }),
    })
    fc.assert(
      fc.property(
        fc.oneof(convexPolygon(10), starPolygon(16)),
        fc.double({ min: 4, max: 40, noNaN: true }),
        fc.constantFrom<PackId>('dxb-ap', 'custom', 'mum-suburbs-res', 'bkk-y9'),
        entered,
        (points: Vec2[], roadWidthM, packId, limits) => {
          const plot = { ...plotFromMetres(points, [{ edge: 0, widthM: roadWidthM }]), limits }
          const { solution, options } = designedUnder(packId, plot)
          for (const d of options) {
            assertInsideEnvelope(solution, d)
            expect(computed(d).filter((c) => c.status === 'fail' && c.id !== 'front-open-space')).toEqual([])
            assertHonestLimit(solution, d)
            assertNamedFromResult(solution, d)
          }
        },
      ),
      { numRuns: 40 },
    )
  })
})

describe('the low-rise block', () => {
  it('never loses floor area when more storeys are allowed, however the envelope compares with the cap', () => {
    fc.assert(
      fc.property(
        fc.oneof(convexPolygon(10), starPolygon(16)),
        fc.double({ min: 4, max: 40, noNaN: true }),
        fc.double({ min: 0.5, max: 6, noNaN: true }),
        fc.integer({ min: 1, max: 15 }),
        fc.integer({ min: 1, max: 10 }),
        (points: Vec2[], roadWidthM, maxFar, storeys, more) => {
          const plot = (maxStoreys: number) => ({ ...plotFromMetres(points, [{ edge: 0, widthM: roadWidthM }]), limits: { maxFar, maxStoreys } })
          const lower = byId(designedUnder('dxb-ap', plot(storeys)).options, 'low-rise')
          const taller = byId(designedUnder('dxb-ap', plot(storeys + more)).options, 'low-rise')
          if (!lower || !taller) return
          expect(taller.metrics.gfaSqm).toBeGreaterThanOrEqual(lower.metrics.gfaSqm - AREA_TOLERANCE_SQM)
        },
      ),
      { numRuns: 40 },
    )
  })

  it('gets within a tenth of a floor of the extra-large threshold without reaching it, unless the whole ground cannot', () => {
    const CENT_SQM = 0.01
    const unbounded = (solution: Solution, highRise: Solution['limits']['highRise']): Solution => ({
      ...solution,
      limits: { ...solution.limits, highRise },
      farCap: { ...solution.farCap, maxGfaSqm: Infinity },
    })
    fc.assert(
      fc.property(
        fc.oneof(convexPolygon(10), starPolygon(16)),
        fc.double({ min: 4, max: 40, noNaN: true }),
        fc.double({ min: 0.3, max: 1.5, noNaN: true }),
        (points: Vec2[], roadWidthM, share) => {
          const scaled = points.map(([x, y]): Vec2 => [4 * x, 4 * y])
          const solution = solve(plotFromMetres(scaled, [{ edge: 0, widthM: roadWidthM }]), pack, readings)
          const fullSqm = TYPOLOGIES['low-rise'](unbounded(solution, null))?.plates.gfaSqm
          if (!fullSqm) return
          const highRise = solution.limits.highRise!
          const threshold = { ...highRise.extraLargeFromFloorAreaSqm, value: share * fullSqm }
          const block = TYPOLOGIES['low-rise'](unbounded(solution, { ...highRise, extraLargeFromFloorAreaSqm: threshold }))!
          const floors = block.plates.floors.length
          expect(satisfies(block.plates.gfaSqm, threshold)).toBe(false)
          expect(block.plates.gfaSqm).toBeGreaterThanOrEqual(Math.min(threshold.value, fullSqm) - threshold.value / floors / 10 - floors * CENT_SQM)
        },
      ),
      { numRuns: 40 },
    )
  })
})

describe('what stops a design', () => {
  it('on the Bangkok example, says the high-rise threshold stops the block and the envelope stops the tower, short of the cap', () => {
    const { solution, options } = designedUnder('bkk-y9', EXAMPLE_PLOT)
    expect(byId(options, 'low-rise')!.limitedBy).toBe('building-class')
    expect(byId(options, 'podium-tower')!.limitedBy).toBe('envelope')
    for (const d of options) expect(reachesCap(solution, d)).toBe(false)
  })

  it('says the height limit stops a design that runs out of storeys before the cap', () => {
    const { solution, options } = designedUnder('dxb-ap', { ...DUBAI_PLOT, limits: { maxFar: 6, maxStoreys: 3 } })
    for (const d of options) {
      expect(d.limitedBy).toBe('height')
      expect(shortOfCap(solution, d)).toBeGreaterThan(AREA_TOLERANCE_SQM)
    }
  })
})

describe('design names follow the result', () => {
  it('calls the 13-storey Bangkok tower high-rise and the 7-storey block not', () => {
    const { solution, options } = designedUnder('bkk-y9', EXAMPLE_PLOT)
    expect(byId(options, 'podium-tower')!.name).toEqual({ form: 'podium-tower', storeys: 13, highRise: true })
    expect(byId(options, 'low-rise')!.name).toEqual({ form: 'block', storeys: 7, highRise: false })
    for (const d of options) assertNamedFromResult(solution, d)
  })

  it('names a 9-storey, 27.9 m Dubai block by its storeys, with no class word the rules do not define', () => {
    const block = byId(designedUnder('dxb-ap', DUBAI_PLOT).options, 'low-rise')!
    expect(block.metrics.heightM).toBeCloseTo(27.9, 6)
    expect(block.name).toEqual({ form: 'block', storeys: 9, highRise: false })
  })
})

describe('Mumbai side and rear open spaces (Table A) carved out of the envelope', () => {
  const MUMBAI = loadPack('mum-suburbs-res')
  const withoutTableA: typeof MUMBAI = { ...MUMBAI, sideRearOpenSpaces: undefined }
  const designedWith = (regionPack: typeof MUMBAI, plot: Plot) => {
    const solution = solve(plot, regionPack, packInterpretations(regionPack))
    return { solution, options: designs(solution) }
  }
  const SMALL_PLOT = plotFromMetres(rectangle(10, 12), [{ edge: 0, widthM: 9 }])

  function clearanceM(solution: Solution, polygons: Design['plates']['footprint'], edge: number): number {
    const { ring } = solution.site
    const [a, b] = [ring[edge], ring[(edge + 1) % ring.length]]
    return Math.min(...polygons.flatMap((polygon) => polygon.outer.map((p, i) => segmentDistance(p, polygon.outer[(i + 1) % polygon.outer.length], a, b))))
  }

  const lowestClearanceM = (solution: Solution, d: Design) => {
    const boundaries = solution.site.edges.flatMap((edge, i) => (edge.roadWidthM === null ? [i] : []))
    return Math.min(...d.plates.floors.flatMap((floor) => boundaries.map((edge) => clearanceM(solution, floor.polygons, edge))))
  }

  it('keeps every floor of every design outside the side and rear open space Table A asks for the design’s full height', () => {
    fc.assert(
      fc.property(fc.oneof(convexPolygon(10), starPolygon(16)), fc.double({ min: 4, max: 40, noNaN: true }), (points: Vec2[], roadWidthM) => {
        const { solution, options } = designedWith(MUMBAI, plotFromMetres(points, [{ edge: 0, widthM: roadWidthM }]))
        for (const d of options) {
          const requiredM = sideRearOpenSpace(solution.limits.sideRear, d.metrics.heightM).distanceM
          expect(lowestClearanceM(solution, d)).toBeGreaterThanOrEqual(requiredM - 1e-3)
        }
      }),
      { numRuns: 40 },
    )
  })

  it('holds the slab on the 20,118 sq ft plot on 5 m roads 3.6 m off both neighbours, so its footprint shrinks and it still reaches the cap', () => {
    const before = byId(designedWith(withoutTableA, MUMBAI_PLOT).options, 'slab')!
    const { solution, options } = designedWith(MUMBAI, MUMBAI_PLOT)
    const after = byId(options, 'slab')!
    expect(solution.limits.sideRear?.plotClass).toBe('large')
    expect(solution.envelopes[0].tiers[0].setbacks.map((s) => s.distanceM)).toEqual([4.5, 4.5, 3.6, 3.6])
    expect(after.metrics.footprintSqm).toBeLessThan(before.metrics.footprintSqm - 50)
    expect([before.limitedBy, after.limitedBy]).toEqual(['far', 'far'])
    expect(after.checks.find((c) => c.id === 'boundary-setback')).toMatchObject({ status: 'pass', limit: 3.6 })
  })

  it('holds a tall design on a 10 m × 12 m plot H/5 off its neighbours on every floor, not 3.6 m on the lower ones', () => {
    const before = designedWith(withoutTableA, SMALL_PLOT).options
    const { solution, options } = designedWith(MUMBAI, SMALL_PLOT)
    expect(solution.limits.sideRear?.plotClass).toBe('small')
    expect(before.map((d) => d.limitedBy)).toEqual(['far', 'far'])
    expect(byId(before, 'slab')!.checks.find((c) => c.id === 'boundary-setback')?.status).toBe('fail')
    expect(options.map((d) => [d.metrics.storeys, d.limitedBy])).toEqual([
      [6, 'envelope'],
      [6, 'envelope'],
    ])
    for (const d of options) {
      expect(lowestClearanceM(solution, d)).toBeGreaterThanOrEqual(d.metrics.heightM / 5 - 1e-3)
      expect(lowestClearanceM(solution, d)).toBeGreaterThan(3.6)
      expect(d.metrics.gfaSqm).toBeLessThan(solution.farCap.maxGfaSqm)
      const check = d.checks.find((c) => c.id === 'boundary-setback')
      expect(check?.status).toBe('pass')
      expect(check && 'limit' in check ? check.limit : 0).toBeCloseTo(d.metrics.heightM / 5, 9)
      expect(computed(d).filter((c) => c.status === 'fail')).toEqual([])
    }
  })

  it('draws nothing above 70 m on the smaller plot class, where Table A is blank', () => {
    const { solution } = designedWith(MUMBAI, plotFromMetres(rectangle(30, 30), [{ edge: 0, widthM: 40 }]))
    expect(solution.limits.sideRear?.plotClass).toBe('small')
    expect(solution.envelopes[0].prisms.at(-1)!.topM).toBeLessThanOrEqual(70)
  })
})

describe('headline design', () => {
  it('is the design with the most floor area', () => {
    const { options } = designedUnder('bkk-y9', EXAMPLE_PLOT)
    const most = Math.max(...options.map((d) => d.metrics.gfaSqm))
    expect(headline(options)!.metrics.gfaSqm).toBe(most)
    expect(headline(options)!.id).toBe('low-rise')
  })

  it('breaks a tie at the cap with the lower design, and reaches the cap on the Mumbai and Dubai plots', () => {
    for (const { solution, options } of [designedUnder('mum-suburbs-res', MUMBAI_PLOT), designedUnder('dxb-ap', DUBAI_PLOT)]) {
      const top = headline(options)!
      expect(top.limitedBy).toBe('far')
      expect(reachesCap(solution, top)).toBe(true)
      expect(top.metrics.heightM).toBe(Math.min(...options.map((d) => d.metrics.heightM)))
    }
  })

  it('is nothing when no design fits', () => {
    expect(headline([])).toBeNull()
  })

  it('never passes over a design with more floor area, nor a lower one with as much', () => {
    const [template] = designedUnder('bkk-y9', EXAMPLE_PLOT).options
    const variant = fc.record({ gfaSqm: fc.double({ min: 0, max: 20_000, noNaN: true }), heightM: fc.double({ min: 3, max: 200, noNaN: true }) })
    fc.assert(
      fc.property(fc.array(variant, { minLength: 1, maxLength: 6 }), (variants) => {
        const options = variants.map((v): Design => ({ ...template, metrics: { ...template.metrics, ...v } }))
        const top = headline(options)!
        for (const d of options) {
          expect(d.metrics.gfaSqm).toBeLessThanOrEqual(top.metrics.gfaSqm + AREA_TOLERANCE_SQM)
          if (d.metrics.gfaSqm >= top.metrics.gfaSqm) expect(d.metrics.heightM).toBeGreaterThanOrEqual(top.metrics.heightM)
        }
      }),
    )
  })
})
