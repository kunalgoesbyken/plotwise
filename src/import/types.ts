import type { LngLat } from '@/geo/projection'
import type { LengthUnit } from './units'
import type { UtmZone } from './utm'

export type Pair = readonly [number, number]

export type Shape = { name: string | null; points: readonly Pair[]; closed: boolean }

export type DegreeOrder = 'lng-lat' | 'lat-lng'
export type UtmOrder = 'east-north' | 'north-east'

export type Question =
  | { kind: 'fixed' }
  | { kind: 'degrees'; orders: readonly DegreeOrder[] }
  | { kind: 'utm'; orders: readonly UtmOrder[] }
  | { kind: 'drawing'; unit: LengthUnit | null }

export type Source = { shapes: readonly Shape[]; question: Question }

export type Georef =
  | { kind: 'degrees'; order: DegreeOrder }
  | ({ kind: 'utm'; order: UtmOrder; unitM: number } & UtmZone)
  | { kind: 'reference'; at: LngLat; unitM: number }

export type ProblemReason =
  | 'unrecognised-coordinates'
  | 'out-of-range'
  | 'outside-region'
  | 'too-few-corners'
  | 'too-many-corners'
  | 'crossing'
  | 'degenerate'
  | 'too-small'
  | 'too-large'
  | 'open-ring'
  | 'file-too-large'
  | 'file-unsupported'
  | 'file-unreadable'
  | 'kml-invalid'
  | 'geojson-invalid'
  | 'dxf-invalid'
  | 'dxf-binary'
  | 'dxf-curved'
  | 'no-polygon'
  | 'no-polyline'

export type Problem = { reason: ProblemReason } | { reason: 'bad-entry'; entry: number }

export type Result<T> = { ok: true; value: T } | { ok: false; problem: Problem }

export const succeed = <T>(value: T): Result<T> => ({ ok: true, value })

export const fail = (reason: ProblemReason): Result<never> => ({ ok: false, problem: { reason } })

export const failEntry = (entry: number): Result<never> => ({ ok: false, problem: { reason: 'bad-entry', entry } })
