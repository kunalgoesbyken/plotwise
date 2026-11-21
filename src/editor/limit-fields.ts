import type { PlotLimitField } from '@/plot/plot'
import type { FloorCount, Region } from '@/region/regions'
import { formatNumber } from '@/text/format'
import { t } from '@/text/messages'
import { readNumber, type ReadNumber } from '@/text/read-number'
import { areaFromDisplay, areaToDisplay, type AreaUnit } from '@/units/area'

export type LimitUnit = 'area' | 'ratio' | 'm' | 'storeys' | 'percent' | 'perSpace' | 'perHome'

export type LimitDisplay = { readonly area: AreaUnit; readonly floors: FloorCount }

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
  parkingSpacesPerHome: 'perHome',
  homeSqm: 'area',
}

export const isAreaField = (field: PlotLimitField) => FIELD_UNITS[field] === 'area' || FIELD_UNITS[field] === 'perSpace'

const PERCENT = 100

function toShown(field: PlotLimitField, value: number, { area, floors }: LimitDisplay): number {
  switch (FIELD_UNITS[field]) {
    case 'area':
    case 'perSpace':
      return areaToDisplay(value, area)
    case 'percent':
      return value * PERCENT
    case 'storeys':
      return floors === 'gPlus' ? value - 1 : value
    case 'ratio':
    case 'm':
    case 'perHome':
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
      return floors === 'gPlus' ? shown + 1 : shown
    case 'ratio':
    case 'm':
    case 'perHome':
      return shown
  }
}

export const limitDisplay = ({ floors }: Region, area: AreaUnit): LimitDisplay => ({ area, floors })

export const limitLabel = (field: PlotLimitField, { limitTerms }: Region) => limitTerms?.fields[field]?.value ?? t(`limits.custom.${field}`)

export const limitName = (field: PlotLimitField, { limitTerms }: Region) => limitTerms?.fields[field]?.value ?? t(`plot-limit.${field}`)

export function shownLimit(field: PlotLimitField, value: number, display: LimitDisplay): string {
  return formatNumber(toShown(field, value, display), 'plain')
}

export function parseLimit(field: PlotLimitField, text: string, display: LimitDisplay): ReadNumber {
  const read = readNumber(text)
  return read.kind === 'number' ? { kind: 'number', value: fromShown(field, read.value, display) } : read
}
