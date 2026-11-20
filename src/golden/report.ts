import { designs, type Design } from '@/designs'
import type { Plot } from '@/plot/plot'
import { loadPack } from '@/rules'
import { packInterpretations, parkingSpaces, solve, type FarMode, type ParkingNeed, type Solution } from '@/solve'

const pack = loadPack('bkk-y9')
const readings = packInterpretations(pack)

const PARKING_PROBES: readonly Omit<ParkingNeed, 'use'>[] = [
  { floorAreaSqm: 5_000, large: false, units: 80, unitSqm: 35, rooms: 100, lobbySqm: 100, officeSqm: 3_500 },
  { floorAreaSqm: 40_000, large: true, units: 800, unitSqm: 35, rooms: 700, lobbySqm: 700, officeSqm: 29_000 },
]

function parkingProbes({ limits, plot }: Solution) {
  return PARKING_PROBES.map((need) => parkingSpaces(limits.parking.rules, { ...need, use: plot.buildingType }))
}

function limitsReport(solution: Solution) {
  const { far, farBonus, classes, openSpace, height, use, highRise, parking } = solution.limits
  const vsRoadMultiple = height.vsRoadMultiple && { value: height.vsRoadMultiple.value, cites: height.vsRoadMultiple.cites }
  return {
    far,
    farBonus,
    classes,
    openSpace,
    height: { ...height, vsRoadMultiple },
    use,
    highRise,
    parking: { cites: parking.cites, probes: parkingProbes(solution) },
  }
}

function envelopeReport({ kind, floorToFloorM, tiers, prisms }: Solution['envelopes'][number]) {
  return { kind, floorToFloorM, tiers, prisms }
}

function designReport({ id, envelope, limitedBy, metrics, checks, plates }: Design) {
  return {
    id,
    envelope,
    limitedBy,
    metrics,
    checks,
    plates: {
      footprintSqm: plates.footprintSqm,
      gfaSqm: plates.gfaSqm,
      footprint: plates.footprint,
      floors: plates.floors.map(({ level, baseM, topM, areaSqm, polygons }) => ({
        level,
        baseM,
        topM,
        areaSqm,
        loops: polygons.map((polygon) => [polygon.outer.length, ...polygon.holes.map((hole) => hole.length)]),
      })),
    },
  }
}

const PLATFORM_STABLE_DIGITS = 12

function comparable(node: unknown): unknown {
  if (typeof node === 'number') return Number(node.toPrecision(PLATFORM_STABLE_DIGITS))
  if (Array.isArray(node)) return node.map(comparable)
  if (node === null || typeof node !== 'object') return node
  const record = node as Record<string, unknown>
  if ('quote' in record && 'page' in record) return `${record.source} p${record.page} l${record.line} ${record.clause}`
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, comparable(value)]))
}

export function scenarioReport(plot: Plot, farMode: Exclude<FarMode, 'purchased'>) {
  const solution = solve(plot, pack, readings, { mode: farMode })
  return comparable({
    site: { areaSqm: solution.site.areaSqm, ring: solution.site.ring, edges: solution.site.edges.map(({ lengthM, roadWidthM }) => ({ lengthM, roadWidthM })) },
    farCap: solution.farCap,
    limits: limitsReport(solution),
    envelopes: solution.envelopes.map(envelopeReport),
    designs: designs(solution).map(designReport),
  })
}
