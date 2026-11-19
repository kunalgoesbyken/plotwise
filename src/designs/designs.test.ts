import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import type { Vec2 } from '@/geo/projection'
import { convexPolygon, starPolygon } from '@/geometry/arbitraries'
import { intersection } from '@/geometry/clip'
import { totalArea } from '@/geometry'
import type { BuildingType } from '@/plot/plot'
import { loadPack } from '@/rules'
import { buildingControlOpenSpace, isHighRiseOrExtraLarge, packInterpretations, ratioOpenSpace, solve, type Interpretations } from '@/solve'
import { plotFromMetres, rectangle } from '@/solve/test-plots'
import { designs, type Design } from './designs'

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
  it('offers a podium tower, a slab on the main road and a low-rise block on a typical plot', () => {
    const { options } = designed(lot(50, 70, 16))
    expect(options.map((d) => d.id)).toEqual(['podium-tower', 'slab', 'low-rise'])
    expect(options.map((d) => d.nameKey)).toEqual(['design.podium-tower', 'design.slab', 'design.low-rise'])
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
    for (const d of [wide, narrow]) expect(d.metrics.far).toBeGreaterThan(0.9 * pack.far.max.value)
    expect(fromRoad(wide)).toMatchObject({ status: 'pass' })
    expect((fromRoad(wide) as { actual: number }).actual).toBeLessThan((fromRoad(narrow) as { actual: number }).actual)
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
