import { headline } from '@/designs'
import { MAX_ROAD_WIDTH_M, type Plot, type Road } from '@/plot/plot'
import { ASSUMPTIONS, type FarChoice } from '@/solve'
import type { RulePack } from '@/rules'
import { feasibility, type Feasibility } from './compute'
import { roadWidthThresholds } from './road-width-thresholds'

const WIDTH_STEP_M = ASSUMPTIONS.roadWidthStepM.value

export type WidthOutcome = { readonly gfaSqm: number; readonly heightM: number }

export type WidthRow = {
  readonly widthM: number
  readonly current: boolean
  readonly outcome: WidthOutcome | null
}

function widestRoad(roads: readonly Road[]): Road {
  return roads.reduce((widest, road) => (road.widthM > widest.widthM ? road : widest))
}

function sampleWidths(currentM: number, thresholds: readonly number[]): number[] {
  const nextThreshold = thresholds.find((widthM) => widthM > currentM)
  const widths = [currentM - WIDTH_STEP_M, currentM, currentM + WIDTH_STEP_M, ...(nextThreshold === undefined ? [] : [nextThreshold])]
  return [...new Set(widths)].filter((widthM) => widthM > 0 && widthM <= MAX_ROAD_WIDTH_M).sort((a, b) => a - b)
}

function withRoadWidth(plot: Plot, road: Road, widthM: number): Plot {
  return { ...plot, roads: plot.roads.map((r) => (r === road ? { ...r, widthM } : r)) }
}

function bestOutcome(result: Feasibility): WidthOutcome | null {
  const top = result.status === 'ready' ? headline(result.designs) : null
  return top && { gfaSqm: top.metrics.gfaSqm, heightM: top.metrics.heightM }
}

export function widthSensitivity(plot: Plot, pack: RulePack, far: FarChoice): WidthRow[] {
  const road = widestRoad(plot.roads)
  return sampleWidths(road.widthM, roadWidthThresholds(pack)).map((widthM) => ({
    widthM,
    current: widthM === road.widthM,
    outcome: bestOutcome(feasibility(withRoadWidth(plot, road, widthM), pack, far)),
  }))
}
