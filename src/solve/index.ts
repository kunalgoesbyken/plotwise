export {
  AREA_TIERS,
  AFFECTION_PLAN_TERMS,
  CARPET_RATIO_NOTE,
  PURCHASE_USE_ORDER,
  ASSUMPTIONS,
  DEFAULT_READINGS,
  MONEY_REGIONS,
  type AreaMap,
  type AreaTier,
  type AssumedRange,
  type Assumption,
  type ExampleMoney,
  type GenericMoney,
  type LocalMoney,
  type MoneyRegion,
  type RegionId,
  type SplitRange,
} from './assumptions'
export { compare, inRange, negate, satisfies } from './bound'
export { isHighRiseOrExtraLarge, isLarge, type Building } from './building'
export { type ClassMembership, type Classes } from './classes'
export type { CoverageLimit } from './coverage'
export { type Envelope, type EnvelopeKind, type EnvelopeTier } from './envelope'
export { SolveError, type SolveErrorReason } from './errors'
export { farCapFor, purchaseUse, STANDARD, type PurchaseUse, type BonusMeasure, type FarCap, type FarChoice, type FarMode, type PurchaseOption, type PurchaseRatios } from './far'
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
export { isParkingUnset, isUnentered, plotLimitFields } from './plot-limits'
export { wideningStrip, type Widening } from './reservations'
export { boundarySetback, frontOpenSpaceDepth, lowRiseRow, lowRiseSetbacks, rearEdge, roadSetback, streetHeightLimitM, strictest, type HeightVsRoad, type Setback } from './setbacks'
export { rowCites, sideRearOpenSpace, type PlotClass, type SideRearLimit } from './side-rear'
export type { Hold } from './holds'
export { coversBuildingType, solve, withEveryPurchase, withoutHighRiseRules, type Solution } from './solve'
