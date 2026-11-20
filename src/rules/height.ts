import { z } from 'zod'
import { AbsentTermSchema, BoundSchema, CiteSchema, CitedSchema } from './cite'

const PlanHeightLimitSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none'), absent: AbsentTermSchema }),
  z.object({ kind: z.literal('maxMetres'), maxM: CitedSchema }),
  z.object({ kind: z.literal('maxStoreys'), maxStoreys: CitedSchema }),
  z.object({ kind: z.literal('plotSpecific') }),
])

const RoadMultipleSchema = z.object({
  distance: z.enum(['toBuilding', 'streetPlusFrontSpace']),
  maxMultipleOfDistance: z.array(CitedSchema).min(1),
  measuredTo: CiteSchema.optional(),
  heightToHighestPoint: CiteSchema.optional(),
  widestStreetGoverns: CiteSchema.optional(),
  rooftopStructuresExcluded: CiteSchema.optional(),
  parallelRoads: z.object({ maxRoadSpacingM: BoundSchema, maxBuildingWidthM: BoundSchema }).optional(),
  cornerNarrowerRoadMaxLengthM: BoundSchema.optional(),
  wideRoadException: z.object({ roadWidthM: BoundSchema, withinM: BoundSchema, accessWidthM: BoundSchema }).optional(),
})

export const HeightSchema = z.object({ planLimit: PlanHeightLimitSchema, roadMultiple: RoadMultipleSchema.optional() })

export type PlanHeightLimit = z.infer<typeof PlanHeightLimitSchema>
export type RoadMultiple = z.infer<typeof RoadMultipleSchema>
export type Height = z.infer<typeof HeightSchema>
