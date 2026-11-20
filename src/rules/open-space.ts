import { z } from 'zod'
import { CiteSchema, CitedSchema } from './cite'

export const OpenSpaceRatioSchema = z.object({
  minShareOfFloorArea: CitedSchema,
  definition: CiteSchema,
  permeableShareOfOpenSpace: CitedSchema,
  notBelowBuildingControl: CiteSchema,
})

export const OpenSpaceMinimumSchema = z.object({
  use: z.enum(['residential', 'nonResidential']),
  scope: z.enum(['anyBuilding', 'highRiseOrExtraLarge']),
  base: z.enum(['largestFloorArea', 'landArea']),
  minShare: CitedSchema,
})

export type OpenSpaceRatio = z.infer<typeof OpenSpaceRatioSchema>
export type OpenSpaceMinimumRule = z.infer<typeof OpenSpaceMinimumSchema>
