import type { PlotLimitField } from '@/plot/plot'
import { areaFromDisplay, areaToDisplay, type AreaUnit } from '@/units/area'

export type LimitUnit = 'area' | 'ratio' | 'm' | 'storeys' | 'percent' | 'perSpace'

export type LimitDisplay = { readonly area: AreaUnit; readonly floors: 'storeys' | 'aboveGround' }

export const FIELD_UNITS: Readonly<Record<PlotLimitField, LimitUnit>> = {
  maxGfaSqm: 'area',
  maxFar: 'ratio',
  maxHeightM: 'm',
  maxStoreys: 'storeys',
  maxCoverageShare: 'percent',
  roadSetbackM: 'm',
  boundarySetbackM: 'm',
  minOpenSpaceShare: 'percent',
  parkingSqmPerSpace: 'perSpace',
}

const PERCENT = 100
const PRECISION = 12
const DECIMAL = /^(\d+\.?\d*|\.\d+)$/

function toShown(field: PlotLimitField, value: number, { area, floors }: LimitDisplay): number {
  switch (FIELD_UNITS[field]) {
    case 'area':
    case 'perSpace':
      return areaToDisplay(value, area)
    case 'percent':
      return value * PERCENT
    case 'storeys':
      return floors === 'aboveGround' ? value - 1 : value
    case 'ratio':
    case 'm':
      return value
  }
}

function fromShown(field: PlotLimitField, shown: number, { area, floors }: LimitDisplay): number {
  switch (FIELD_UNITS[field]) {
    case 'area':
    case 'perSpace':
      return areaFromDisplay(shown, area)
    case 'percent':
      return shown / PERCENT
    case 'storeys':
      return floors === 'aboveGround' ? shown + 1 : shown
    case 'ratio':
    case 'm':
      return shown
  }
}

export const shownLimit = (field: PlotLimitField, value: number, display: LimitDisplay) =>
  String(Number(toShown(field, value, display).toPrecision(PRECISION)))

export function parseLimit(field: PlotLimitField, text: string, display: LimitDisplay): number | undefined | null {
  const trimmed = text.trim().replaceAll(',', '')
  if (trimmed === '') return undefined
  if (!DECIMAL.test(trimmed)) return null
  return fromShown(field, Number(trimmed), display)
}
