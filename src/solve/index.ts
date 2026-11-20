export { ASSUMPTIONS, MONEY_REGIONS, type AssumedRange, type Assumption, type MoneyRegion, type RegionId } from './assumptions'
export { compare, inRange, negate, satisfies } from './bound'
export { isHighRiseOrExtraLarge, isLarge, type Building } from './building'
export { mainRoad, type Envelope, type EnvelopeKind, type EnvelopeTier } from './envelope'
export {
  InterpretationsSchema,
  packInterpretations,
  type Interpretations,
  type QuestionId,
} from './interpretations'
export {
  farCapFor,
  highRiseAllows,
  stationDistance,
  type BonusMeasure,
  type ClassMembership,
  type Exemption,
  type FarCap,
  type FarMode,
  type HighRiseAccessBand,
  type Limits,
  type OpenSpaceMinimum,
  type Sourced,
  type UseLimit,
} from './limits'
export { buildingControlOpenSpace, footprintCapSqm, permeableArea, ratioOpenSpace, type OpenSpaceNeed } from './open-space'
export { parkingSpaces, type ParkingNeed } from './parking'
export { boundarySetback, frontOpenSpaceDepth, roadSetback, strictest, type Setback } from './setbacks'
export { solve, type Solution } from './solve'
