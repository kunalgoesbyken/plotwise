import { z } from 'zod'
import { AbsentTermSchema, BoundSchema, CiteSchema, CitedSchema, RangeSchema } from './cite'

export const UseConditionSchema = z.discriminatedUnion('kind', [
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

export const UseConditionsSchema = z.object({
  condo: UseConditionSchema,
  office: UseConditionSchema,
  hotel: UseConditionSchema,
  roadAccessTiers: z.array(RoadAccessTierSchema).min(1),
  stationDistanceFrom: CiteSchema,
})

export const BuildingClassesSchema = z.object({
  highRiseFromHeightM: BoundSchema,
  extraLargeFromFloorAreaSqm: BoundSchema,
  largeAboveFloorAreaSqm: BoundSchema,
  largeIfTallFromHeightM: BoundSchema,
  largeIfTallAboveFloorAreaSqm: BoundSchema,
  heightMeasuredToRoofDeck: CiteSchema,
})

const MembershipSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('stated'), member: z.boolean(), cite: CiteSchema }),
  z.object({ kind: z.literal('question'), questionId: z.string().min(1) }),
])

const ClassificationSchema = z.object({ residential: MembershipSchema, publicBuilding: MembershipSchema })

export const ClassificationsSchema = z.object({ condo: ClassificationSchema, office: ClassificationSchema, hotel: ClassificationSchema })

const HighRiseAccessBandSchema = z.object({
  floorAreaSqm: RangeSchema,
  frontageM: BoundSchema,
  roadWidthM: BoundSchema,
})

export const HighRiseSchema = z.object({
  access: z.array(HighRiseAccessBandSchema).min(1),
  accessStripWidthM: BoundSchema,
  fireLaneWidthM: BoundSchema,
  farMax: CitedSchema,
})

export type UseCondition = z.infer<typeof UseConditionSchema>
export type UseConditions = z.infer<typeof UseConditionsSchema>
export type BuildingClasses = z.infer<typeof BuildingClassesSchema>
export type Membership = z.infer<typeof MembershipSchema>
export type HighRiseRules = z.infer<typeof HighRiseSchema>
