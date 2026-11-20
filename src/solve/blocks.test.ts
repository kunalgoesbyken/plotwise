import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import { designs } from '@/designs'
import { totalArea } from '@/geometry'
import type { PlotLimits, Road } from '@/plot/plot'
import { enteredBound, enteredCite, type FarPurchase, type RoadSetbackRule, type RulePack } from '@/rules'
import { loadPack, RulePackSchema } from '@/rules'
import { band, BANGKOK, PER_PLOT, unverified, value } from '@/rules/test-packs'
import { ASSUMPTIONS } from './assumptions'
import { SolveError } from './errors'
import { packInterpretations } from './interpretations'
import { plotLimitFields } from './plot-limits'
import type { FarChoice } from './far'
import { wideningStrip } from './reservations'
import { lowRiseSetbacks, rearEdge, roadSetback } from './setbacks'
import { solve } from './solve'
import { plotFromMetres, rectangle } from './test-plots'

function lot(widthM: number, depthM: number, roads: readonly Road[], limits?: PlotLimits) {
  return { ...plotFromMetres(rectangle(widthM, depthM), roads), limits }
}

const onRoad = (widthM: number) => [{ edge: 0, widthM }]

const solveWith = (pack: RulePack, plot: ReturnType<typeof lot>, far: FarChoice = { mode: 'standard' }) => solve(plot, pack, packInterpretations(pack), far)

const BUY_ALL: FarChoice = { mode: 'purchased', ratios: { premium: Infinity, transferableRights: Infinity, fungible: Infinity } }

const FAR_TABLE = unverified({
  far: {
    kind: 'byRoadWidthAndPlotSize',
    roadWidthBands: [
      { roadWidthM: band(undefined, 12), byPlotSize: [{ plotAreaSqm: band(undefined, 1000), ratio: value(1.5) }, { plotAreaSqm: band(1000), ratio: value(2) }] },
      { roadWidthM: band(12), byPlotSize: [{ plotAreaSqm: band(undefined, 1000), ratio: value(2.5) }, { plotAreaSqm: band(1000), ratio: value(3) }] },
    ],
    notes: [],
  },
})

describe('FAR from a road width × plot size table', () => {
  it('reads the ratio from the row for the main road width and the plot size', () => {
    expect(solveWith(FAR_TABLE, lot(20, 40, onRoad(9))).limits.far.ratio).toBe(1.5)
    expect(solveWith(FAR_TABLE, lot(40, 50, onRoad(9))).limits.far.ratio).toBe(2)
    expect(solveWith(FAR_TABLE, lot(20, 40, onRoad(12))).limits.far.ratio).toBe(2.5)
    expect(solveWith(FAR_TABLE, lot(40, 50, onRoad(16))).limits.far.ratio).toBe(3)
  })

  it('takes the widest road of a corner plot', () => {
    const corner = lot(40, 50, [
      { edge: 0, widthM: 8 },
      { edge: 1, widthM: 16 },
    ])
    expect(solveWith(FAR_TABLE, corner).limits.far.ratio).toBe(3)
  })

  it('never falls as the road widens and always caps floor area at ratio × plot area', () => {
    fc.assert(
      fc.property(fc.double({ min: 15, max: 60, noNaN: true }), fc.double({ min: 3, max: 30, noNaN: true }), (sideM, roadM) => {
        const narrow = solveWith(FAR_TABLE, lot(sideM, sideM, onRoad(roadM))).limits.far
        const wide = solveWith(FAR_TABLE, lot(sideM, sideM, onRoad(roadM + 6))).limits.far
        expect(wide.ratio).toBeGreaterThanOrEqual(narrow.ratio)
        expect(narrow.maxGfaSqm).toBeCloseTo(narrow.ratio * sideM * sideM, 6)
      }),
      { numRuns: 30 },
    )
  })
})

describe('limits given for each plot', () => {
  const limits = { maxGfaSqm: 5000, maxHeightM: 40, maxStoreys: 10, maxCoverageShare: 0.5, roadSetbackM: 4, boundarySetbackM: 3 }

  it('lists the fields a pack needs the user to enter', () => {
    expect(plotLimitFields(BANGKOK)).toEqual([])
    expect(plotLimitFields(PER_PLOT)).toEqual(['maxGfaSqm', 'maxFar', 'maxHeightM', 'maxStoreys', 'maxCoverageShare', 'roadSetbackM', 'boundarySetbackM'])
  })

  it('uses the entered floor area, cited as entered, and marks the result unverified', () => {
    const solution = solveWith(PER_PLOT, lot(40, 50, onRoad(12), limits))
    expect(solution.limits.far.maxGfaSqm).toBe(5000)
    expect(solution.limits.far.ratio).toBeCloseTo(2.5, 9)
    expect(solution.limits.far.cites).toContainEqual(enteredCite('maxGfaSqm'))
    expect(solution.verification).toBe('unverified')
    expect(solveWith(BANGKOK, lot(40, 50, onRoad(12))).verification).toBe('verified')
  })

  it('caps height at the lower of the entered metres and storeys', () => {
    const floorM = ASSUMPTIONS.floorToFloorM.condo.value
    const byStoreys = solveWith(PER_PLOT, lot(40, 50, onRoad(12), limits)).limits.height
    expect(byStoreys.planLimitM).toBeCloseTo(Math.min(40, 10 * floorM), 9)
    const byMetres = solveWith(PER_PLOT, lot(40, 50, onRoad(12), { ...limits, maxHeightM: 12 })).limits.height
    expect(byMetres).toMatchObject({ planLimitM: 12, cites: [enteredCite('maxHeightM'), enteredCite('maxStoreys')] })
  })

  it('caps ground coverage at the entered share of the plot', () => {
    expect(solveWith(PER_PLOT, lot(40, 50, onRoad(12), limits)).limits.coverage?.maxFootprintSqm).toBeCloseTo(1000, 6)
  })

  it('keeps the envelope behind the entered road and boundary setbacks', () => {
    const [ground] = solveWith(PER_PLOT, lot(40, 50, onRoad(12), limits)).envelopes[0].tiers
    expect(ground.setbacks.map((s) => s.distanceM)).toEqual([4, 3, 3, 3])
  })

  it.each([
    ['maxGfaSqm', ['maxGfaSqm', 'maxFar']],
    ['maxHeightM', ['maxHeightM', 'maxStoreys']],
    ['maxCoverageShare', ['maxCoverageShare']],
  ] as const)('refuses to solve without %s', (field, fields) => {
    const missing: PlotLimits = { ...limits, [field]: undefined, ...(field === 'maxHeightM' ? { maxStoreys: undefined } : {}) }
    const solving = () => solveWith(PER_PLOT, lot(40, 50, onRoad(12), missing))
    expect(solving).toThrow(SolveError)
    try {
      solving()
    } catch (error) {
      expect((error as SolveError).fields).toEqual(fields)
    }
  })
})

describe('a plan height cap', () => {
  const capped = (planLimit: RulePack['height']['planLimit']) => unverified({ height: { ...BANGKOK.height, planLimit } })

  it('caps the envelope and every design, with a passing height check', () => {
    const solution = solveWith(capped({ kind: 'maxMetres', maxM: value(30) }), lot(60, 80, onRoad(30)))
    expect(solution.limits.height.planLimitM).toBe(30)
    for (const envelope of solution.envelopes) expect(envelope.prisms.at(-1)!.topM).toBeLessThanOrEqual(30 + 1e-9)
    for (const design of designs(solution)) {
      expect(design.metrics.heightM).toBeLessThanOrEqual(30 + 1e-9)
      expect(design.checks.find((c) => c.id === 'height-cap')).toMatchObject({ status: 'pass', limit: 30 })
    }
  })

  it('turns a storey cap into metres with the floor height of the building type', () => {
    const solution = solveWith(capped({ kind: 'maxStoreys', maxStoreys: value(8) }), lot(60, 80, onRoad(30)))
    expect(solution.limits.height.planLimitM).toBeCloseTo(8 * ASSUMPTIONS.floorToFloorM.condo.value, 9)
  })

  it('draws an uncapped envelope at the engine resolution when nothing limits height', () => {
    const open = unverified({ height: { planLimit: BANGKOK.height.planLimit }, buildingClasses: undefined, highRise: undefined })
    const [envelope] = solveWith(open, lot(60, 80, onRoad(30))).envelopes
    const storeys = ASSUMPTIONS.unboundedHeightStoreys.value
    expect(envelope.prisms.at(-1)!.topM).toBeCloseTo(storeys * ASSUMPTIONS.floorToFloorM.condo.value, 6)
  })
})

describe('height as a multiple of the street plus the required front open space', () => {
  const FRONT_M = 4.5
  const STREET = unverified({
    height: { planLimit: BANGKOK.height.planLimit, roadMultiple: { distance: 'streetPlusFrontSpace', maxMultipleOfDistance: [value(3)] } },
    roadSetbacks: [{ bands: [{ roadWidthM: band(), setback: { kind: 'fromRoadBoundary', distanceM: value(FRONT_M) } }] }],
    frontOpenSpace: undefined,
    buildingClasses: undefined,
    highRise: undefined,
  })
  const floorM = ASSUMPTIONS.floorToFloorM.condo.value

  it('caps the envelope at the multiple of the widest street plus its front open space, with no step-back', () => {
    fc.assert(
      fc.property(fc.double({ min: 6, max: 30, noNaN: true }), fc.double({ min: 0, max: 10, noNaN: true }), (roadM, widerByM) => {
        const corner = lot(50, 60, [
          { edge: 0, widthM: roadM },
          { edge: 1, widthM: roadM + widerByM },
        ])
        const solution = solveWith(STREET, corner)
        const ceilingM = 3 * (roadM + widerByM + FRONT_M)
        const [envelope] = solution.envelopes
        expect(envelope.prisms.at(-1)!.topM).toBeCloseTo(Math.floor(ceilingM / floorM + 1e-9) * floorM, 6)
        expect(new Set(envelope.tiers.map((tier) => tier.setbacks.map((s) => s.distanceM).join()))).toHaveProperty('size', 1)
        for (const design of designs(solution)) expect(design.checks.find((c) => c.id === 'height-vs-road')).toMatchObject({ status: 'pass', limit: expect.closeTo(ceilingM, 9) })
      }),
      { numRuns: 15 },
    )
  })
})

describe('open spaces relaxed for ground and one upper floor on a small plot (Table No 17)', () => {
  const MUMBAI = loadPack('mum-suburbs-res')
  const twoStoreys = RulePackSchema.parse({ ...MUMBAI, height: { ...MUMBAI.height, planLimit: { kind: 'maxStoreys', maxStoreys: value(2) } } })
  const building = (storeys: number) => ({ heightM: storeys * 3, storeys, floorAreaSqm: 100 })

  it('reads the row for the plot area and applies only up to ground and one upper floor', () => {
    expect(lowRiseSetbacks(MUMBAI, 100, building(2))).toMatchObject({ front: { distanceM: 1.5 }, rear: { distanceM: 3 }, side: { distanceM: 1 } })
    expect(lowRiseSetbacks(MUMBAI, 25, building(1))).toMatchObject({ front: { distanceM: 0.75 }, rear: { distanceM: 1.5 }, side: { distanceM: 0 } })
    expect(lowRiseSetbacks(MUMBAI, 100, building(3))).toBeNull()
    expect(lowRiseSetbacks(MUMBAI, 300, building(2))).toBeNull()
    expect(lowRiseSetbacks(BANGKOK, 100, building(2))).toBeNull()
  })

  it('takes the boundary edge farthest from the main road as the rear', () => {
    expect(rearEdge(solveWith(MUMBAI, lot(10, 12, onRoad(9))).site)).toBe(2)
    expect(rearEdge(solveWith(MUMBAI, lot(10, 12, [{ edge: 1, widthM: 9 }])).site)).toBe(3)
  })

  it('checks a low design on a small plot against the relaxed open spaces', () => {
    const solution = solveWith(twoStoreys, lot(10, 12, onRoad(9), { boundarySetbackM: 3 }))
    expect(designs(solution).length).toBeGreaterThan(0)
    for (const design of designs(solution)) {
      expect(design.metrics.storeys).toBeLessThanOrEqual(2)
      expect(design.checks.find((c) => c.id === 'road-setback')).toMatchObject({ status: 'pass', limit: 1.5 })
      expect(design.checks.find((c) => c.id === 'boundary-setback')).toMatchObject({ status: 'pass', limit: 3 })
    }
  })
})

describe('ground coverage', () => {
  const COVERAGE = unverified({ coverage: { kind: 'maxShare', share: value(0.3), notes: [] } })

  it('keeps every design footprint within the share of the plot, checked and passing', () => {
    fc.assert(
      fc.property(fc.double({ min: 25, max: 70, noNaN: true }), fc.double({ min: 8, max: 30, noNaN: true }), (sideM, roadM) => {
        const solution = solveWith(COVERAGE, lot(sideM, sideM, onRoad(roadM)))
        for (const design of designs(solution)) {
          expect(design.plates.footprintSqm).toBeLessThanOrEqual(0.3 * sideM * sideM + 1e-6)
          expect(design.checks.find((c) => c.id === 'coverage')).toMatchObject({ status: 'pass' })
        }
      }),
      { numRuns: 10 },
    )
  })
})

describe('road widening', () => {
  const widening = (farOn: 'gross' | 'net') =>
    unverified({ reservations: [{ kind: 'roadWidening', target: { kind: 'width', widthM: value(12) }, farOn, notes: [] }] })
  const perFrontage = unverified({
    reservations: [
      {
        kind: 'roadWidening',
        target: { kind: 'perFrontage', cite: enteredCite('test') },
        farOn: 'net',
        inLieu: { multipleOfReserved: value(2), notes: [] },
        notes: [],
      },
    ],
  })
  const share = ASSUMPTIONS.wideningShareOnPlotSide.value

  it('reserves the plot side of the missing width along a narrow road and solves the envelope on what is left', () => {
    const { site, widening: strip, landAreaSqm } = solveWith(widening('net'), lot(40, 50, onRoad(8)))
    expect(strip).toMatchObject({
      grossAreaSqm: expect.closeTo(2000, 6),
      reservedSqm: expect.closeTo(40 * 4 * share, 6),
      depthsM: [4 * share, 0, 0, 0],
      farOn: 'net',
      inLieuGfaSqm: 0,
    })
    expect(site.areaSqm).toBeCloseTo(1920, 6)
    expect(site.edges[0].roadWidthM).toBe(12)
    expect(landAreaSqm).toBeCloseTo(2000, 6)
  })

  it('takes FAR on the land left after the strip, or on the whole plot where the rules give FAR in lieu', () => {
    const net = solveWith(widening('net'), lot(40, 50, onRoad(8)))
    const gross = solveWith(widening('gross'), lot(40, 50, onRoad(8)))
    expect(net.farAreaSqm).toBeCloseTo(1920, 6)
    expect(net.limits.far.maxGfaSqm).toBeCloseTo(7 * 1920, 6)
    expect(gross.farAreaSqm).toBeCloseTo(2000, 6)
    expect(gross.limits.far.maxGfaSqm).toBeCloseTo(7 * 2000, 6)
    for (const design of designs(gross)) expect(design.metrics.far).toBeCloseTo(design.metrics.gfaSqm / 2000, 9)
  })

  it('leaves a plot on a road already that wide untouched', () => {
    const { site, widening: strip, landAreaSqm, farAreaSqm } = solveWith(widening('gross'), lot(40, 50, onRoad(16)))
    expect(strip).toBeNull()
    expect([site.areaSqm, landAreaSqm, farAreaSqm].map(Math.round)).toEqual([2000, 2000, 2000])
  })

  it('widens each road to the width the user prescribed for it, and only that road', () => {
    const corner = lot(40, 50, [
      { edge: 0, widthM: 9, prescribedWidthM: 18 },
      { edge: 1, widthM: 12 },
    ])
    const { site, widening: strip } = solveWith(perFrontage, corner)
    expect(strip?.depthsM).toEqual([9 * share, 0, 0, 0])
    expect(site.edges.map((e) => [e.roadWidthM, e.prescribedWidthM])).toEqual([
      [18, null],
      [12, null],
      [null, null],
      [null, null],
    ])
    expect(solveWith(perFrontage, lot(40, 50, onRoad(9))).widening).toBeNull()
  })

  it('draws the strip handed over between the plot and the land left, with exactly the reserved area', () => {
    fc.assert(
      fc.property(fc.double({ min: 3, max: 20, noNaN: true }), fc.double({ min: 0.5, max: 20, noNaN: true }), (roadM, extraM) => {
        const solution = solveWith(perFrontage, lot(40, 50, [{ edge: 0, widthM: roadM, prescribedWidthM: roadM + extraM }]))
        const strip = wideningStrip(solution.widening!, solution.site.ring)
        expect(totalArea(strip)).toBeCloseTo(solution.widening!.reservedSqm, 2)
      }),
      { numRuns: 20 },
    )
  })

  it('ignores a prescribed width where the rules take no widening', () => {
    expect(solveWith(BANGKOK, lot(40, 50, [{ edge: 0, widthM: 9, prescribedWidthM: 18 }])).widening).toBeNull()
  })

  it('grants floor area in lieu of the land handed over, on top of the floor area on the land left', () => {
    fc.assert(
      fc.property(fc.double({ min: 3, max: 20, noNaN: true }), fc.double({ min: 0.5, max: 20, noNaN: true }), (roadM, extraM) => {
        const solution = solveWith(perFrontage, lot(40, 50, [{ edge: 0, widthM: roadM, prescribedWidthM: roadM + extraM }]))
        const reserved = 40 * extraM * share
        expect(solution.widening?.reservedSqm).toBeCloseTo(reserved, 6)
        expect(solution.widening?.inLieuGfaSqm).toBeCloseTo(2 * reserved, 6)
        expect(solution.farAreaSqm).toBeCloseTo(2000 - reserved, 6)
        expect(solution.landAreaSqm).toBeCloseTo(2000, 6)
        expect(solution.farCap.maxGfaSqm).toBeCloseTo(solution.limits.far.maxGfaSqm + 2 * reserved, 6)
      }),
      { numRuns: 30 },
    )
  })
})

describe('purchasable FAR', () => {
  const premium = (cap: FarPurchase['cap'], price: FarPurchase['price']): RulePack =>
    unverified({ farPurchases: [{ kind: 'premium', cap, price, notes: [] }] })

  it('adds floor area capped as an extra ratio of the plot', () => {
    const solution = solveWith(premium({ kind: 'extraRatio', ratio: value(0.5) }, { kind: 'perSqm', value: value(1000) }), lot(40, 50, onRoad(16)), BUY_ALL)
    expect(solution.limits.farPurchase.extraGfaSqm).toBeCloseTo(1000, 6)
    expect(solution.farCap).toMatchObject({ mode: 'purchased', maxGfaSqm: expect.closeTo(15000, 6) })
  })

  it('caps extra floor area as a share of the base', () => {
    const { farPurchase } = solveWith(premium({ kind: 'shareOf', of: 'base', share: value(0.1) }, { kind: 'userSupplied' }), lot(40, 50, onRoad(16)), BUY_ALL).limits
    expect(farPurchase.extraGfaSqm).toBeCloseTo(1400, 6)
  })

  it('falls back to the standard cap where nothing can be bought, and lists the purchase as a check', () => {
    expect(solveWith(BANGKOK, lot(40, 50, onRoad(16)), BUY_ALL).farCap.mode).toBe('standard')
    const solution = solveWith(premium({ kind: 'extraRatio', ratio: value(0.5) }, { kind: 'userSupplied' }), lot(40, 50, onRoad(16)), BUY_ALL)
    for (const design of designs(solution)) expect(design.checks.find((c) => c.id === 'far-purchase')).toMatchObject({ status: 'manual' })
  })
})

describe('purchasable FSI from the Mumbai draft: premium and TDR by road width, fungible on the permissible total', () => {
  const NARROW_M = 9
  const WIDE_M = 12
  const MUMBAI = loadPack('mum-suburbs-res')
  const extras = (roadM: number, far: FarChoice = BUY_ALL) => solveWith(MUMBAI, lot(40, 50, onRoad(roadM)), far).limits.farPurchase

  it('reads the premium and TDR caps from the band of the main road', () => {
    expect(extras(10).options.map((o) => [o.kind, Math.round(o.maxExtraGfaSqm)])).toEqual([
      ['premium', 1000],
      ['transferableRights', 1000],
      ['fungible', 1400],
    ])
    expect(extras(16).options.map((o) => Math.round(o.maxExtraGfaSqm))).toEqual([1000, 1400, 1540])
    expect(extras(30).options.map((o) => Math.round(o.maxExtraGfaSqm))).toEqual([1000, 2000, 1750])
  })

  it('allows no premium or TDR below the narrowest band, so fungible applies to the base alone', () => {
    expect(extras(8).options.map((o) => Math.round(o.maxExtraGfaSqm))).toEqual([0, 0, 700])
  })

  it('caps the purchased total at base plus every extra, with fungible at its share of the permissible total', () => {
    fc.assert(
      fc.property(fc.double({ min: 3, max: 40, noNaN: true }), (roadM) => {
        const purchase = extras(roadM)
        const [premiumExtra, tdrExtra, fungibleExtra] = purchase.options.map((o) => o.maxExtraGfaSqm)
        expect(fungibleExtra).toBeCloseTo(0.35 * (2000 + premiumExtra + tdrExtra), 6)
        expect(purchase.extraGfaSqm).toBeCloseTo(premiumExtra + tdrExtra + fungibleExtra, 6)
      }),
      { numRuns: 30 },
    )
  })

  it('buys only the ratio chosen for each kind, never more than its cap, with fungible on what was bought', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 2, noNaN: true }), fc.double({ min: 0, max: 2, noNaN: true }), fc.double({ min: 0, max: 2, noNaN: true }), (p, t, f) => {
        const purchase = extras(16, { mode: 'purchased', ratios: { premium: p, transferableRights: t, fungible: f } })
        const [premiumBuy, tdrBuy, fungibleBuy] = purchase.options.map((o) => o.chosenGfaSqm)
        expect(premiumBuy).toBeCloseTo(Math.min(p, 0.5) * 2000, 6)
        expect(tdrBuy).toBeCloseTo(Math.min(t, 0.7) * 2000, 6)
        expect(purchase.options[2].maxExtraGfaSqm).toBeCloseTo(0.35 * (2000 + premiumBuy + tdrBuy), 6)
        expect(fungibleBuy).toBeCloseTo(Math.min(f * 2000, 0.35 * (2000 + premiumBuy + tdrBuy)), 6)
        expect(purchase.extraGfaSqm).toBeCloseTo(premiumBuy + tdrBuy + fungibleBuy, 6)
      }),
      { numRuns: 50 },
    )
  })

  it('buys nothing in the standard mode, so the cap is the base alone', () => {
    const solution = solveWith(MUMBAI, lot(40, 50, onRoad(16)))
    expect(solution.limits.farPurchase.extraGfaSqm).toBe(0)
    expect(solution.farCap).toMatchObject({ mode: 'standard', maxGfaSqm: expect.closeTo(2000, 6) })
    expect(solution.limits.farPurchase.options.map((o) => Math.round(o.maxExtraGfaSqm))).toEqual([1000, 1400, 700])
  })

  it('refuses road-width caps with a gap between bands', () => {
    const gap: FarPurchase['cap'] = {
      kind: 'extraRatioByRoadWidth',
      bands: [
        { kind: 'ratio', roadWidthM: band(undefined, NARROW_M), ratio: value(0.5) },
        { kind: 'ratio', roadWidthM: band(WIDE_M), ratio: value(0.5) },
      ],
    }
    expect(() => unverified({ farPurchases: [{ kind: 'premium', cap: gap, price: { kind: 'userSupplied' }, notes: [] }] })).toThrow()
  })
})

describe('road setbacks by building height and road width', () => {
  const row = (appliesAbove: RoadSetbackRule['appliesAbove'], narrowM: number, wideM: number): RoadSetbackRule => ({
    appliesAbove,
    bands: [
      { roadWidthM: band(undefined, 12), setback: { kind: 'fromRoadBoundary', distanceM: value(narrowM) } },
      { roadWidthM: band(12), setback: { kind: 'fromRoadBoundary', distanceM: value(wideM) } },
    ],
  })
  const TABLE = unverified({
    roadSetbacks: [row({ storeys: enteredBound(1, 'gte', 'test') }, 3, 4.5), row({ heightM: enteredBound(24, 'gte', 'test') }, 6, 9)],
  })
  const building = (heightM: number) => ({ heightM, storeys: Math.round(heightM / 3), floorAreaSqm: 5000 })

  it('reads the row for the building height and the column for the road width', () => {
    expect(roadSetback(TABLE, building(15), 8).distanceM).toBe(3)
    expect(roadSetback(TABLE, building(15), 16).distanceM).toBe(4.5)
    expect(roadSetback(TABLE, building(30), 8).distanceM).toBe(6)
    expect(roadSetback(TABLE, building(30), 16).distanceM).toBe(9)
  })

  it('refuses a row that says neither the height nor the storeys it starts from', () => {
    expect(() => unverified({ roadSetbacks: [row({}, 3, 4.5)] })).toThrow()
  })
})

