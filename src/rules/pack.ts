import { z } from 'zod'
import { containsEntered, CiteSchema } from './cite'
import { BlindWallSchema, BoundarySetbackSchema, FrontOpenSpaceSchema, PlotSetbacksSchema, RoadSetbackSchema } from './setbacks'
import { BuildingClassesSchema, ClassificationsSchema, HighRiseSchema, UseConditionsSchema } from './classes'
import { FarBonusBlockSchema, FarPurchaseSchema, FarRuleSchema } from './far'
import { CoverageSchema, ReservationSchema } from './footprint'
import { HeightSchema } from './height'
import { OpenSpaceMinimumSchema, OpenSpaceRatioSchema } from './open-space'
import { ParkingRuleSchema } from './parking'
import { GapSchema, QuestionSchema } from './questions'

const SourceSchema = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  url: z.url(),
  published: z.string().min(1),
  kind: z.enum(['gazette', 'consolidated']),
  textLayer: z.enum(['readable', 'garbled']),
})

export const RulePackSchema = z
  .object({
    id: z.string().min(1),
    verification: z.enum(['verified', 'unverified']),
    zone: z.object({ code: z.string().min(1), cite: CiteSchema }).optional(),
    sources: z.record(z.string(), SourceSchema),
    far: FarRuleSchema,
    farBonus: FarBonusBlockSchema.optional(),
    farPurchases: z.array(FarPurchaseSchema).optional(),
    height: HeightSchema,
    coverage: CoverageSchema.optional(),
    reservations: z.array(ReservationSchema).optional(),
    openSpaceRatio: OpenSpaceRatioSchema.optional(),
    openSpaceMinimums: z.array(OpenSpaceMinimumSchema),
    roadSetbacks: z.array(RoadSetbackSchema),
    boundarySetbacks: z.array(BoundarySetbackSchema),
    plotSetbacks: PlotSetbacksSchema.optional(),
    blindWall: BlindWallSchema.optional(),
    frontOpenSpace: FrontOpenSpaceSchema.optional(),
    useConditions: UseConditionsSchema.optional(),
    buildingClasses: BuildingClassesSchema.optional(),
    classification: ClassificationsSchema.optional(),
    highRise: HighRiseSchema.optional(),
    parking: z.array(ParkingRuleSchema),
    questions: z.array(QuestionSchema),
    gaps: z.array(GapSchema),
  })
  .refine((pack) => pack.verification === 'unverified' || !containsEntered(pack), {
    message: 'a verified pack cannot hold values entered by a user',
    path: ['verification'],
  })
  .refine((pack) => !pack.highRise || pack.buildingClasses, {
    message: 'high-rise rules need the building classes that define a high-rise',
    path: ['highRise'],
  })

export type RulePack = z.infer<typeof RulePackSchema>
