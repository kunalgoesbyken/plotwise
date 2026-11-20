import { z } from 'zod'
import { BoundSchema, CiteSchema, CitedSchema, RangeSchema, UpperBoundSchema } from './cite'

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
    .refine((above) => above.storeys || above.heightM, { message: 'a road setback must say the storeys or height it applies from' })
    .optional(),
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

export const LowRiseOpenSpacesSchema = z.object({
  appliesTo: CiteSchema,
  maxUpperFloors: CitedSchema,
  rows: z
    .array(z.object({ plotAreaSqm: RangeSchema, frontM: CitedSchema, rearM: CitedSchema, sideM: CitedSchema.optional() }))
    .min(1),
})

const SideRearDistanceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('shareOfHeight'), share: CitedSchema, minM: CitedSchema.optional(), maxM: CitedSchema.optional() }),
  z.object({ kind: z.literal('fixed'), distanceM: CitedSchema }),
])

const SideRearRowSchema = z.object({ heightM: RangeSchema, distance: SideRearDistanceSchema })

export const SideRearOpenSpacesSchema = z.object({
  appliesTo: CiteSchema,
  smallPlot: z.object({ areaSqm: UpperBoundSchema, averageWidthOrDepthM: UpperBoundSchema }),
  smallPlotRows: z.array(SideRearRowSchema).min(1),
  largePlotRows: z.array(SideRearRowSchema).min(1),
})

export const BlindWallSchema = z.object({ minDistanceM: CitedSchema, onBoundaryMaxHeightM: BoundSchema })

export type BoundarySetbackRule = z.infer<typeof BoundarySetbackSchema>
export type RoadSetbackRule = z.infer<typeof RoadSetbackSchema>
export type RoadSetbackDistance = z.infer<typeof RoadSetbackDistanceSchema>
export type FrontOpenSpace = z.infer<typeof FrontOpenSpaceSchema>
export type LowRiseOpenSpaces = z.infer<typeof LowRiseOpenSpacesSchema>
export type SideRearOpenSpaces = z.infer<typeof SideRearOpenSpacesSchema>
export type SideRearRow = z.infer<typeof SideRearRowSchema>
