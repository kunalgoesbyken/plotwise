import { z } from 'zod'

export const BUILDING_TYPES = ['condo', 'office', 'hotel'] as const
export type BuildingType = (typeof BUILDING_TYPES)[number]

export const LngLatSchema = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])

export const MAX_ROAD_WIDTH_M = 200

export const MAX_CORNERS = 100

export const RoadWidthSchema = z.number().positive().max(MAX_ROAD_WIDTH_M)

const RoadSchema = z.object({
  edge: z.int().nonnegative(),
  widthM: RoadWidthSchema,
  name: z.string().optional(),
})

export const MAX_PLOT_LIMIT = 1_000_000

export const MAX_STOREYS = 200

export const MAX_FAR = 100

const LimitSchema = z.number().positive().max(MAX_PLOT_LIMIT)

const ShareSchema = z.number().positive().max(1)

export const PlotLimitsSchema = z.object({
  maxGfaSqm: LimitSchema.optional(),
  maxFar: z.number().positive().max(MAX_FAR).optional(),
  maxHeightM: LimitSchema.optional(),
  maxStoreys: z.int().positive().max(MAX_STOREYS).optional(),
  maxCoverageShare: ShareSchema.optional(),
  roadSetbackM: z.number().min(0).max(MAX_ROAD_WIDTH_M).optional(),
  boundarySetbackM: z.number().min(0).max(MAX_ROAD_WIDTH_M).optional(),
  minOpenSpaceShare: z.number().min(0).lt(1).optional(),
  parkingSqmPerSpace: LimitSchema.optional(),
})

export const PlotSchema = z
  .object({
    ring: z.array(LngLatSchema).min(3).max(MAX_CORNERS),
    roads: z.array(RoadSchema).min(1),
    buildingType: z.enum(BUILDING_TYPES),
    nearStation: z.boolean().default(false),
    limits: PlotLimitsSchema.optional(),
  })
  .refine((p) => p.roads.every((r) => r.edge < p.ring.length), { message: 'road edge outside the ring', path: ['roads'] })
  .refine((p) => new Set(p.roads.map((r) => r.edge)).size === p.roads.length, {
    message: 'two roads on one edge',
    path: ['roads'],
  })

export type PlotLimits = z.infer<typeof PlotLimitsSchema>
export type PlotLimitField = keyof PlotLimits

export const isPlotLimitField = (field: string): field is PlotLimitField => field in PlotLimitsSchema.shape
export type Plot = z.infer<typeof PlotSchema>
export type Road = z.infer<typeof RoadSchema>
