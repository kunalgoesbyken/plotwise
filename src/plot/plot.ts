import { z } from 'zod'

export const BUILDING_TYPES = ['condo', 'office', 'hotel'] as const
export type BuildingType = (typeof BUILDING_TYPES)[number]

const LngLatSchema = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])

const RoadSchema = z.object({
  edge: z.int().nonnegative(),
  widthM: z.number().positive(),
  name: z.string().optional(),
})

export const PlotSchema = z
  .object({
    ring: z.array(LngLatSchema).min(3),
    roads: z.array(RoadSchema).min(1),
    buildingType: z.enum(BUILDING_TYPES),
  })
  .refine((p) => p.roads.every((r) => r.edge < p.ring.length), { message: 'road edge outside the ring', path: ['roads'] })
  .refine((p) => new Set(p.roads.map((r) => r.edge)).size === p.roads.length, {
    message: 'two roads on one edge',
    path: ['roads'],
  })

export type Plot = z.infer<typeof PlotSchema>
export type Road = z.infer<typeof RoadSchema>
