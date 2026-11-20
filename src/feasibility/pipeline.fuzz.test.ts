import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import type { Design } from '@/designs'
import { localFrame, type LngLat, type Vec2 } from '@/geo/projection'
import { totalArea } from '@/geometry'
import { intersection } from '@/geometry/clip'
import { initialEditorState, reduceEditor } from '@/editor/editor-state'
import { roundLngLat } from '@/editor/plot-draft'
import { BUILDING_TYPES, type Plot } from '@/plot/plot'
import type { RegionId, Solution } from '@/solve'
import { layerSolids, solidsGeometry } from '@/scene/meshes'
import { framingOf } from '@/scene/framing'
import { REGIONS } from '@/region/regions'
import { loadPack } from '@/rules'
import { feasibility } from './compute'
import { carvingRules, envelopeLayers, RULE_STEPS } from './rule-layers'

const TAU = 2 * Math.PI
const FUZZ_TIMEOUT_MS = 30_000
const AREA_TOLERANCE_SQM = 0.05
const RELATIVE_AREA_TOLERANCE = 1e-6

const BANGKOK: LngLat = [100.5636, 13.7466]

const real = (min: number, max: number) => fc.double({ min, max, noNaN: true })

function rotated(points: readonly Vec2[], angle: number): Vec2[] {
  const [c, s] = [Math.cos(angle), Math.sin(angle)]
  return points.map(([x, y]) => [x * c - y * s, x * s + y * c])
}

const rectangle = (width: number, depth: number): Vec2[] => [
  [0, 0],
  [width, 0],
  [width, depth],
  [0, depth],
]

const star = (vertices: number) =>
  fc
    .record({
      gaps: fc.array(real(1, 2), { minLength: vertices, maxLength: vertices }),
      radii: fc.array(real(0.02, 1), { minLength: vertices, maxLength: vertices }),
    })
    .map(({ gaps, radii }): Vec2[] => {
      const total = gaps.reduce((sum, gap) => sum + gap, 0)
      let running = 0
      return gaps.map((gap, i): Vec2 => {
        running += gap
        const angle = (running / total) * TAU
        return [radii[i] * Math.cos(angle), radii[i] * Math.sin(angle)]
      })
    })

const concave = fc.integer({ min: 3, max: 100 }).chain(star)

const sliver = fc.tuple(real(5, 1000), real(0.002, 3)).map(([width, depth]) => rectangle(width, depth))

const tiny = fc.tuple(real(3, 8), real(3, 8)).map(([width, depth]) => rectangle(width, depth))

const nearCollinear = fc
  .record({
    width: real(10, 200),
    depth: real(10, 200),
    nudges: fc.array(real(-1e-2, 1e-2), { minLength: 1, maxLength: 6 }),
  })
  .map(({ width, depth, nudges }): Vec2[] => {
    const along = nudges.map((nudge, i): Vec2 => [(width * (i + 1)) / (nudges.length + 1), nudge])
    return [[0, 0], ...along, [width, 0], [width, depth], [0, depth]]
  })

const scaled = (shape: readonly Vec2[], radiusM: number): Vec2[] => shape.map(([x, y]) => [x * radiusM, y * radiusM])

const outline = fc
  .oneof(
    { weight: 3, arbitrary: fc.tuple(concave, real(5, 1000)).map(([shape, radiusM]) => scaled(shape, radiusM)) },
    { weight: 1, arbitrary: sliver },
    { weight: 1, arbitrary: tiny },
    { weight: 1, arbitrary: nearCollinear },
    { weight: 1, arbitrary: fc.tuple(real(5, 1000), real(5, 1000)).map(([width, depth]) => rectangle(width, depth)) },
  )
  .chain((points) =>
    fc.tuple(real(0, TAU), fc.boolean()).map(([angle, mirrored]) => rotated(mirrored ? points.map(([x, y]): Vec2 => [x, -y]) : points, angle)),
  )

const plots: fc.Arbitrary<Plot> = outline.chain((points) =>
  fc
    .record({
      edges: fc.uniqueArray(fc.integer({ min: 0, max: points.length - 1 }), { minLength: 1, maxLength: points.length }),
      widths: fc.array(real(3, 80), { minLength: points.length, maxLength: points.length }),
      buildingType: fc.constantFrom(...BUILDING_TYPES),
      nearStation: fc.boolean(),
      origin: fc.oneof(
        { weight: 4, arbitrary: fc.constant(BANGKOK) },
        { weight: 1, arbitrary: fc.tuple(real(-180, 180), real(-85, 85)) },
      ),
    })
    .map(({ edges, widths, buildingType, nearStation, origin }): Plot => {
      const frame = localFrame(origin)
      return {
        ring: points.map((p) => roundLngLat(frame.toLngLat(p))),
        roads: edges.map((edge, i) => ({ edge, widthM: widths[i] })),
        buildingType,
        nearStation,
      }
    }),
)

function firstNonFinite(value: unknown, path: string): string | null {
  if (typeof value === 'number') return Number.isFinite(value) ? null : `${path} = ${value}`
  if (typeof value !== 'object' || value === null) return null
  for (const [key, child] of Object.entries(value)) {
    const found = firstNonFinite(child, `${path}.${key}`)
    if (found) return found
  }
  return null
}

const expectFinite = (value: unknown, path: string) => expect(firstNonFinite(value, path)).toBeNull()

function expectInsideEnvelope(solution: Solution, design: Design) {
  const envelope = solution.envelopes.find((e) => e.kind === design.envelope)
  expect(envelope).toBeDefined()
  for (const floor of design.plates.floors) {
    const prism = envelope?.prisms.find((p) => p.baseM <= floor.baseM + 1e-6 && floor.topM <= p.topM + 1e-6)
    expect(prism).toBeDefined()
    const area = totalArea(floor.polygons)
    const inside = totalArea(intersection(floor.polygons, prism?.polygons ?? []))
    expect(inside).toBeGreaterThanOrEqual(area - AREA_TOLERANCE_SQM - RELATIVE_AREA_TOLERANCE * area)
  }
}

function expectDrawable(solution: Solution, design: Design) {
  const positions = solidsGeometry(layerSolids(design.plates.floors)).getAttribute('position').array
  expect(positions.every(Number.isFinite)).toBe(true)
  const topM = Math.max(0, ...design.plates.floors.map((f) => f.topM))
  expectFinite(framingOf(solution.site.ring, topM), 'framing')
}

function expectLayersDrawable({ envelopes, site, pack }: Solution) {
  const carving = carvingRules(pack)
  for (const envelope of envelopes)
    for (const step of RULE_STEPS) expectFinite(envelopeLayers(envelope, site, step, carving), `layers.${step}`)
}

function expectSound(solution: Solution, design: Design) {
  expectFinite(design.metrics, 'metrics')
  expectDrawable(solution, design)
  expect(design.metrics.footprintSqm).toBeLessThanOrEqual(solution.site.areaSqm * (1 + RELATIVE_AREA_TOLERANCE) + AREA_TOLERANCE_SQM)
  expect(design.metrics.openSpaceSqm).toBeGreaterThanOrEqual(-AREA_TOLERANCE_SQM)
  expectInsideEnvelope(solution, design)
  expect(design.metrics.gfaSqm).toBeLessThanOrEqual(solution.limits.far.maxGfaSqm * (1 + 1e-9))
  for (const check of design.checks) {
    expect(['pass', 'fail', 'manual']).toContain(check.status)
    if (check.status !== 'manual') expectFinite({ actual: check.actual, limit: check.limit }, check.id)
  }
}

function openLikeTheApp(plot: Plot, region: RegionId = 'bkk') {
  const start = reduceEditor(initialEditorState(plot.buildingType), { type: 'set-region', region })
  return reduceEditor(start, { type: 'load', plot })
}

describe('plot to designs fuzz', () => {
  it('either keeps every design inside its envelope and limits, or fails with a reason the panels explain', () => {
    fc.assert(
      fc.property(plots, (plot) => {
        const loaded = openLikeTheApp(plot)
        if (!loaded.plot) return expect(loaded.notice).not.toBeNull()
        const result = feasibility(loaded.plot, loadPack('bkk-y9'))
        if (result.status === 'failed') return expect(result.reason).not.toBe('unknown')
        expectFinite(result.solution.limits, 'limits')
        expectLayersDrawable(result.solution)
        for (const design of result.designs) expectSound(result.solution, design)
      }),
      { numRuns: 100 },
    )
  }, FUZZ_TIMEOUT_MS)
})

const entered = fc.record(
  {
    maxGfaSqm: real(1, 200_000),
    maxFar: real(0.1, 20),
    maxHeightM: real(3, 300),
    maxStoreys: fc.integer({ min: 1, max: 80 }),
    maxCoverageShare: real(0.05, 1),
    roadSetbackM: real(0, 30),
    boundarySetbackM: real(0, 30),
    minOpenSpaceShare: real(0, 0.95),
    parkingSqmPerSpace: real(10, 500),
  },
  { requiredKeys: [] },
)

describe('plot to designs fuzz with limits the user enters', () => {
  it('keeps every design inside its envelope and limits, or names the limit still missing', () => {
    fc.assert(
      fc.property(plots, entered, fc.constantFrom<RegionId>('custom', 'dxb'), (plot, limits, region) => {
        const loaded = openLikeTheApp({ ...plot, limits }, region)
        if (!loaded.plot) return expect(loaded.notice).not.toBeNull()
        const result = feasibility(loaded.plot, loadPack(REGIONS[region].packId))
        if (result.status === 'failed') return expect(result.reason).not.toBe('unknown')
        expect(result.solution.verification).toBe('unverified')
        expectFinite(result.solution.limits, 'limits')
        expectLayersDrawable(result.solution)
        for (const design of result.designs) expectSound(result.solution, design)
      }),
      { numRuns: 100 },
    )
  }, FUZZ_TIMEOUT_MS)
})
