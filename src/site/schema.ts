import { z } from 'zod'
import { HIGHWAY_CLASSES } from './assumptions'
import { BboxSchema } from './bbox'

const LngLatSchema = z.tuple([z.number(), z.number()]).readonly()
const RingSchema = z.array(LngLatSchema).min(3)

export const BuildingSchema = z
  .object({
    id: z.string(),
    outer: RingSchema,
    holes: z.array(RingSchema),
    heightM: z.number().positive(),
    heightSource: z.enum(['height', 'levels', 'default']),
    minHeightM: z.number().nonnegative(),
  })
  .refine((building) => building.minHeightM < building.heightM, {
    error: 'minHeightM must be below heightM',
    path: ['minHeightM'],
  })

export const RoadSchema = z.object({
  id: z.string(),
  line: z.array(LngLatSchema).min(2),
  name: z.string().optional(),
  nameTh: z.string().optional(),
  highway: z.enum(HIGHWAY_CLASSES),
  widthM: z.number().positive(),
  widthSource: z.enum(['width', 'lanes', 'class']),
  grade: z.enum(['ground', 'elevated', 'tunnel']),
})

export const SiteDataSchema = z.object({
  buildings: z.array(BuildingSchema),
  roads: z.array(RoadSchema),
})

export const SiteSchema = SiteDataSchema.extend({
  bbox: BboxSchema,
  attribution: z.string(),
})

export const SiteErrorSchema = z.object({ error: z.string() })

export type Building = z.infer<typeof BuildingSchema>
export type Road = z.infer<typeof RoadSchema>
export type SiteData = z.infer<typeof SiteDataSchema>
export type Site = z.infer<typeof SiteSchema>
