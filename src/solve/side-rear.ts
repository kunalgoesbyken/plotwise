import type { Vec2 } from '@/geo/projection'
import { dot, length, subtract } from '@/geometry'
import type { Site } from '@/plot/site'
import type { Cite, RulePack, SideRearOpenSpaces, SideRearRow } from '@/rules'
import { inRange, satisfies } from './bound'
import { mainRoad } from './envelope'
import { NO_SETBACK, type Setback } from './setbacks'

export type PlotClass = 'small' | 'large'

export type SideRearLimit = {
  readonly plotClass: PlotClass
  readonly rows: readonly SideRearRow[]
  readonly appliesTo: Cite
  readonly smallPlot: SideRearOpenSpaces['smallPlot']
}

function spreadM(ring: readonly Vec2[], axis: Vec2): number {
  const reach = ring.map((point) => dot(point, axis))
  return Math.max(...reach) - Math.min(...reach)
}

function averageWidthAndDepthM(site: Site): readonly [number, number] {
  const { ring, areaSqm } = site
  const front = mainRoad(site)
  const run = subtract(ring[(front + 1) % ring.length], ring[front])
  const along: Vec2 = [run[0] / length(run), run[1] / length(run)]
  return [areaSqm / spreadM(ring, [-along[1], along[0]]), areaSqm / spreadM(ring, along)]
}

function plotClass({ smallPlot }: SideRearOpenSpaces, site: Site): PlotClass {
  const small = satisfies(site.areaSqm, smallPlot.areaSqm) || averageWidthAndDepthM(site).some((m) => satisfies(m, smallPlot.averageWidthOrDepthM))
  return small ? 'small' : 'large'
}

export function sideRearLimit({ sideRearOpenSpaces: rule }: RulePack, site: Site): SideRearLimit | null {
  if (!rule) return null
  const of = plotClass(rule, site)
  return { plotClass: of, rows: of === 'small' ? rule.smallPlotRows : rule.largePlotRows, appliesTo: rule.appliesTo, smallPlot: rule.smallPlot }
}

export function rowDistanceM({ distance }: SideRearRow, heightM: number): number {
  if (distance.kind === 'fixed') return distance.distanceM.value
  const { share, minM, maxM } = distance
  return Math.min(maxM?.value ?? Infinity, Math.max(minM?.value ?? 0, share.value * heightM))
}

export function rowCites({ distance }: SideRearRow): Cite[] {
  if (distance.kind === 'fixed') return [distance.distanceM.cite]
  return [distance.share, distance.minM, distance.maxM].flatMap((cited) => (cited ? [cited.cite] : []))
}

export function sideRearOpenSpace(limit: SideRearLimit | null, heightM: number): Setback {
  if (!limit) return NO_SETBACK
  const row = limit.rows.find((r) => inRange(heightM, r.heightM)) ?? limit.rows[limit.rows.length - 1]
  return { distanceM: rowDistanceM(row, heightM), cites: [limit.appliesTo, ...rowCites(row)] }
}

export const sideRearCeilingM = (limit: SideRearLimit | null) => (limit ? (limit.rows[limit.rows.length - 1].heightM.max?.value ?? Infinity) : Infinity)
