import { z } from 'zod'

export const ComparatorSchema = z.enum(['lt', 'lte', 'gt', 'gte'])

export const CiteSchema = z.object({
  source: z.string().min(1),
  clause: z.string().min(1),
  page: z.int().positive(),
  line: z.int().positive(),
  quote: z.string().min(1),
})

export const CitedSchema = z.object({ value: z.number().finite(), cite: CiteSchema })

export const BoundSchema = z.object({ value: z.number().finite(), cmp: ComparatorSchema, cite: CiteSchema })

const LowerBoundSchema = BoundSchema.extend({ cmp: z.enum(['gt', 'gte']) })
const UpperBoundSchema = BoundSchema.extend({ cmp: z.enum(['lt', 'lte']) })

export const RangeSchema = z
  .object({ min: LowerBoundSchema.optional(), max: UpperBoundSchema.optional() })
  .refine((r) => !r.min || !r.max || r.min.value < r.max.value, { message: 'empty range' })

const SourceSchema = z.object({
  title: z.string().min(1),
  url: z.url(),
  published: z.string().min(1),
  kind: z.enum(['gazette', 'consolidated']),
  textLayer: z.enum(['readable', 'garbled']),
})

const AbsentTermSchema = z.object({ term: z.string().min(1), from: CiteSchema, to: CiteSchema })

const HeightBandSchema = z.object({ heightM: RangeSchema, distanceM: CitedSchema })

const BoundarySetbackSchema = z.object({
  rule: z.enum(['wallsWithOpenings', 'clearanceAroundBuilding', 'outermostPart']),
  scope: z.enum(['anyBuilding', 'highRiseOrExtraLarge']),
  from: z.enum(['plotBoundary', 'plotBoundaryOrPublicRoad']),
  bands: z.array(HeightBandSchema).min(1),
})

const RoadSetbackDistanceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('fromCentreline'), distanceM: CitedSchema }),
  z.object({ kind: z.literal('fromRoadBoundary'), distanceM: CitedSchema }),
  z.object({ kind: z.literal('fromRoadBoundaryShareOfWidth'), share: CitedSchema }),
])

const RoadSetbackSchema = z.object({
  appliesAbove: z.object({ storeys: BoundSchema, heightM: BoundSchema }),
  bands: z.array(z.object({ roadWidthM: RangeSchema, setback: RoadSetbackDistanceSchema })).min(1),
})

const OpenSpaceMinimumSchema = z.object({
  use: z.enum(['residential', 'nonResidential']),
  scope: z.enum(['anyBuilding', 'highRiseOrExtraLarge']),
  base: z.enum(['largestFloorArea', 'landArea']),
  minShare: CitedSchema,
})

const FarBonusSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('affordableHousing'),
    eligible: z.literal('residential'),
    maxShare: CitedSchema,
    maxExtraPerProvidedArea: CitedSchema,
  }),
  z.object({
    kind: z.literal('publicOpenSpace'),
    eligible: z.literal('publicBuilding'),
    zones: CiteSchema,
    maxShare: CitedSchema,
    maxExtraPerProvidedArea: CitedSchema,
    excludesBuildingControlOpenSpace: CiteSchema,
  }),
  z.object({
    kind: z.literal('publicParking'),
    eligible: z.literal('publicBuilding'),
    maxStationDistanceM: BoundSchema,
    maxShare: CitedSchema,
    maxExtraPerSpaceSqm: CitedSchema,
    parkingExemptFromFarAndOsr: CiteSchema,
  }),
  z.object({
    kind: z.literal('floodRetention'),
    eligible: z.literal('anyBuilding'),
    volumeM3: CitedSchema,
    perLandSqm: CitedSchema,
    baseShare: CitedSchema,
    maxShare: CitedSchema,
  }),
  z.object({
    kind: z.literal('energyRating'),
    eligible: z.literal('anyBuilding'),
    levels: z.array(z.object({ level: CitedSchema, share: CitedSchema })).min(1),
  }),
])

const UseConditionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('notListed'), absent: AbsentTermSchema }),
  z.object({
    kind: z.literal('restrictedAbove'),
    measure: z.enum(['rooms', 'operatingAreaSqm']),
    threshold: BoundSchema,
    unlessRoadWidthM: BoundSchema,
    unlessStationDistanceM: BoundSchema,
  }),
])

const RoadAccessTierSchema = z.object({
  roadWidthM: BoundSchema,
  frontageM: BoundSchema,
  otherEndRoadWidthM: BoundSchema,
  maxDistanceM: BoundSchema,
})

const HighRiseAccessBandSchema = z.object({
  floorAreaSqm: RangeSchema,
  frontageM: BoundSchema,
  roadWidthM: BoundSchema,
})

const ParkingDemandSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('perUnit'), spacesPerUnit: CitedSchema, unitsFromSqm: BoundSchema }),
  z.object({ kind: z.literal('perFloorArea'), sqmPerSpace: CitedSchema, appliesFromSqm: BoundSchema }),
  z.object({
    kind: z.literal('perRoomTiers'),
    firstRooms: CitedSchema,
    firstSpaces: CitedSchema,
    tiers: z.array(z.object({ uptoRooms: CitedSchema.optional(), roomsPerSpace: CitedSchema })).min(1),
  }),
  z.object({
    kind: z.literal('perLobbyAndCommercialArea'),
    appliesFromSqm: BoundSchema,
    lobbySqmPerSpace: CitedSchema,
    commercialSqmPerSpace: CitedSchema,
  }),
])

const ParkingRuleSchema = z.object({
  scope: z.enum(['bangkokBylaw', 'ministerialInnerBangkok']),
  appliesWhere: CiteSchema,
  condo: ParkingDemandSchema,
  office: ParkingDemandSchema,
  hotel: ParkingDemandSchema,
  hallSqmPerSpace: CitedSchema,
  largeBuildingSqmPerSpace: CitedSchema,
  largerOfSumOrArea: CiteSchema,
  fractionsRoundUp: CiteSchema,
})

const MembershipSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('stated'), member: z.boolean(), cite: CiteSchema }),
  z.object({ kind: z.literal('question'), questionId: z.string().min(1) }),
])

const ClassificationSchema = z.object({ residential: MembershipSchema, publicBuilding: MembershipSchema })

const QuestionSchema = z
  .object({
    id: z.string().min(1),
    question: z.string().min(1),
    readings: z
      .array(z.object({ id: z.string().min(1), reading: z.string().min(1), cites: z.array(CiteSchema).min(1) }))
      .min(2),
    recommendation: z.string().min(1),
    why: z.string().min(1),
    decision: z.string().nullable(),
  })
  .refine((q) => q.readings.some((r) => r.id === q.recommendation), { message: 'recommendation is not a reading' })
  .refine((q) => q.decision === null || q.readings.some((r) => r.id === q.decision), {
    message: 'decision is not a reading',
  })

const GapSchema = z.object({ id: z.string().min(1), what: z.string().min(1), why: z.string().min(1) })

export const RulePackSchema = z.object({
  id: z.string().min(1),
  zone: z.object({ code: z.string().min(1), cite: CiteSchema, noPlanHeightLimit: AbsentTermSchema }),
  sources: z.record(z.string(), SourceSchema),
  far: z.object({ max: CitedSchema, definition: CiteSchema, subdividedPlotsShareCap: CiteSchema }),
  openSpaceRatio: z.object({
    minShareOfFloorArea: CitedSchema,
    definition: CiteSchema,
    permeableShareOfOpenSpace: CitedSchema,
    notBelowBuildingControl: CiteSchema,
  }),
  farBonus: z.object({ combinedMaxShare: CitedSchema, measures: z.array(FarBonusSchema).min(1) }),
  useConditions: z.object({
    condo: UseConditionSchema,
    office: UseConditionSchema,
    hotel: UseConditionSchema,
    roadAccessTiers: z.array(RoadAccessTierSchema).min(1),
    stationDistanceFrom: CiteSchema,
  }),
  buildingClasses: z.object({
    highRiseFromHeightM: BoundSchema,
    extraLargeFromFloorAreaSqm: BoundSchema,
    largeAboveFloorAreaSqm: BoundSchema,
    largeIfTallFromHeightM: BoundSchema,
    largeIfTallAboveFloorAreaSqm: BoundSchema,
    heightMeasuredToRoofDeck: CiteSchema,
  }),
  classification: z.object({ condo: ClassificationSchema, office: ClassificationSchema, hotel: ClassificationSchema }),
  openSpaceMinimums: z.array(OpenSpaceMinimumSchema).min(1),
  roadSetbacks: z.array(RoadSetbackSchema).min(1),
  boundarySetbacks: z.array(BoundarySetbackSchema).min(1),
  blindWall: z.object({ minDistanceM: CitedSchema, onBoundaryMaxHeightM: BoundSchema }),
  heightVsRoad: z.object({
    maxMultipleOfDistance: z.array(CitedSchema).min(1),
    measuredTo: CiteSchema,
    heightToHighestPoint: CiteSchema,
    rooftopStructuresExcluded: CiteSchema,
    parallelRoads: z.object({ maxRoadSpacingM: BoundSchema, maxBuildingWidthM: BoundSchema }),
    cornerNarrowerRoadMaxLengthM: BoundSchema,
    wideRoadException: z.object({ roadWidthM: BoundSchema, withinM: BoundSchema, accessWidthM: BoundSchema }),
  }),
  frontOpenSpace: z.object({
    appliesTo: CiteSchema,
    depthM: CitedSchema,
    tallAboveStoreys: BoundSchema,
    tallDepthM: CitedSchema,
    minShareOfPerimeter: CitedSchema,
    exemptIfFrontageShareOfPerimeter: BoundSchema,
    exemptIfWithinRoadM: BoundSchema,
  }),
  highRise: z.object({
    access: z.array(HighRiseAccessBandSchema).min(1),
    accessStripWidthM: BoundSchema,
    fireLaneWidthM: BoundSchema,
    farMax: CitedSchema,
  }),
  parking: z.array(ParkingRuleSchema).min(1),
  questions: z.array(QuestionSchema),
  gaps: z.array(GapSchema),
})

export type Comparator = z.infer<typeof ComparatorSchema>
export type Cite = z.infer<typeof CiteSchema>
export type Cited = z.infer<typeof CitedSchema>
export type Bound = z.infer<typeof BoundSchema>
export type Range = z.infer<typeof RangeSchema>
export type FarBonus = z.infer<typeof FarBonusSchema>
export type UseCondition = z.infer<typeof UseConditionSchema>
export type ParkingDemand = z.infer<typeof ParkingDemandSchema>
export type ParkingRule = z.infer<typeof ParkingRuleSchema>
export type Membership = z.infer<typeof MembershipSchema>
export type Question = z.infer<typeof QuestionSchema>
export type RulePack = z.infer<typeof RulePackSchema>
