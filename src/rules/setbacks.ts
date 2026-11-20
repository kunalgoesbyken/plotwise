import { z } from 'zod'
import { BoundSchema, CiteSchema, CitedSchema, RangeSchema } from './cite'

const HeightBandSchema = z.object({ heightM: RangeSchema, distanceM: CitedSchema })

export const BoundarySetbackSchema = z.object({
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

export const RoadSetbackSchema = z.object({
  appliesAbove: z
    .object({ storeys: BoundSchema.optional(), heightM: BoundSchema.optional() })
    .refine((above) => above.storeys || above.heightM, { message: 'a road setback must say the storeys or height it applies from' }),
  bands: z.array(z.object({ roadWidthM: RangeSchema, setback: RoadSetbackDistanceSchema })).min(1),
})

export const FrontOpenSpaceSchema = z.object({
  appliesTo: CiteSchema,
  depthM: CitedSchema,
  tallAboveStoreys: BoundSchema,
  tallDepthM: CitedSchema,
  minShareOfPerimeter: CitedSchema,
  exemptIfFrontageShareOfPerimeter: BoundSchema,
  exemptIfWithinRoadM: BoundSchema,
})

export const BlindWallSchema = z.object({ minDistanceM: CitedSchema, onBoundaryMaxHeightM: BoundSchema })

export type BoundarySetbackRule = z.infer<typeof BoundarySetbackSchema>
export type RoadSetbackRule = z.infer<typeof RoadSetbackSchema>
export type RoadSetbackDistance = z.infer<typeof RoadSetbackDistanceSchema>
export type FrontOpenSpace = z.infer<typeof FrontOpenSpaceSchema>
