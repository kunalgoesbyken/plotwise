import { z } from 'zod'
import { BoundSchema, CiteSchema, CitedSchema, RangeSchema } from './cite'

export const ParkingDemandSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('perUnit'), spacesPerUnit: CitedSchema, unitsFromSqm: BoundSchema }),
  z.object({
    kind: z.literal('perUnitBySize'),
    bands: z.array(z.object({ unitSqm: RangeSchema, spacesPerUnit: CitedSchema })).min(1),
  }),
  z.object({
    kind: z.literal('unitsPerSpaceBySize'),
    bands: z.array(z.object({ unitSqm: RangeSchema, unitsPerSpace: CitedSchema })).min(1),
  }),
  z.object({ kind: z.literal('perFloorArea'), sqmPerSpace: CitedSchema, appliesFromSqm: BoundSchema }),
  z.object({ kind: z.literal('perGrossArea'), sqmPerSpace: CitedSchema }),
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

export const ParkingRuleSchema = z
  .object({
  scope: z.enum(['bangkokBylaw', 'ministerialInnerBangkok', 'mumbaiTable21', 'entered']),
  appliesWhere: CiteSchema,
  condo: ParkingDemandSchema.optional(),
  office: ParkingDemandSchema.optional(),
  hotel: ParkingDemandSchema.optional(),
  visitors: z.object({ share: CitedSchema, min: CitedSchema }).optional(),
  hallSqmPerSpace: CitedSchema.optional(),
  largeBuildingSqmPerSpace: CitedSchema.optional(),
  largerOfSumOrArea: CiteSchema.optional(),
  fractionsRoundUp: CiteSchema.optional(),
  fractionsAboveHalfRoundUp: CiteSchema.optional(),
  })
  .refine((rule) => !(rule.fractionsRoundUp && rule.fractionsAboveHalfRoundUp), { message: 'fractions round one way only' })

export type ParkingDemand = z.infer<typeof ParkingDemandSchema>
export type ParkingRule = z.infer<typeof ParkingRuleSchema>
