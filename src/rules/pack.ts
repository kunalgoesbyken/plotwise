import { z } from 'zod'
import { BUILDING_TYPES } from '@/plot/plot'
import { containsEntered, CiteSchema, CitedSchema } from './cite'
import { PlotSetbacksSchema, PlotSpecificSchema } from './entered'
import { BlindWallSchema, BoundarySetbackSchema, FrontOpenSpaceSchema, LowRiseOpenSpacesSchema, RoadSetbackSchema } from './setbacks'
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
  language: z.enum(['th', 'en']),
})

export type SourceLanguage = z.infer<typeof SourceSchema>['language']

export const RulePackSchema = z
  .object({
    id: z.string().min(1),
    verification: z.enum(['verified', 'unverified']),
    zone: z.object({ code: z.string().min(1), cite: CiteSchema }).optional(),
    sources: z.record(z.string(), SourceSchema),
    buildingTypes: z.array(z.enum(BUILDING_TYPES)).min(1).optional(),
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
    plotOpenSpace: PlotSpecificSchema.optional(),
    plotParking: PlotSpecificSchema.optional(),
    blindWall: BlindWallSchema.optional(),
    frontOpenSpace: FrontOpenSpaceSchema.optional(),
    lowRiseOpenSpaces: LowRiseOpenSpacesSchema.optional(),
    useConditions: UseConditionsSchema.optional(),
    buildingClasses: BuildingClassesSchema.optional(),
    classification: ClassificationsSchema.optional(),
    highRise: HighRiseSchema.optional(),
    parking: z.array(ParkingRuleSchema),
    carpetArea: z.object({ builtUpPerCarpet: z.array(CitedSchema).min(1), definition: CiteSchema }).optional(),
    questions: z.array(QuestionSchema),
    gaps: z.array(GapSchema),
  })
  .refine((pack) => pack.verification === 'unverified' || !containsEntered(pack), {
    message: 'a verified pack cannot hold values entered by a user',
    path: ['verification'],
  })
  .refine((pack) => pack.parking.every((rule) => (pack.buildingTypes ?? BUILDING_TYPES).every((type) => rule[type])), {
    message: 'every parking rule covers every building type the pack covers',
    path: ['parking'],
  })
  .refine((pack) => !pack.highRise === !pack.buildingClasses, {
    message: 'high-rise rules and the building classes that define a high-rise come together',
    path: ['highRise'],
  })

export type RulePack = z.infer<typeof RulePackSchema>
