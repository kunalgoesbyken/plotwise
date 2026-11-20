export { ASSUMPTIONS, DEFAULT_READINGS, MONEY_REGIONS, type AssumedRange, type Assumption, type MoneyRegion, type RegionId } from './assumptions'
export { compare, inRange, negate, satisfies } from './bound'
export { isHighRiseOrExtraLarge, isLarge, type Building } from './building'
export { type ClassMembership, type Classes } from './classes'
export type { CoverageLimit } from './coverage'
export { mainRoad, type Envelope, type EnvelopeKind, type EnvelopeTier } from './envelope'
export { SolveError, type SolveErrorReason } from './errors'
export { farCapFor, type BonusMeasure, type FarCap, type FarMode, type PurchaseOption } from './far'
export {
  InterpretationsSchema,
  packInterpretations,
  type Interpretations,
  type QuestionId,
} from './interpretations'
export {
  highRiseAllows,
  stationDistance,
  type Exemption,
  type HighRiseAccessBand,
  type HighRiseLimits,
  type Limits,
  type OpenSpaceMinimum,
  type Sourced,
  type UseLimit,
} from './limits'
export { buildingControlOpenSpace, footprintCapSqm, permeableArea, ratioOpenSpace, type OpenSpaceNeed } from './open-space'
export { parkingSpaces, type ParkingNeed } from './parking'
export { plotLimitFields } from './plot-limits'
export type { Widening } from './reservations'
export { boundarySetback, frontOpenSpaceDepth, roadSetback, strictest, type Setback } from './setbacks'
export { solve, type Solution } from './solve'
