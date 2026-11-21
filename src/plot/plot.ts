import { z } from 'zod'
import { ASSUMPTIONS } from '@/solve/assumptions'

export const BUILDING_TYPES = ['condo', 'office', 'hotel'] as const
export type BuildingType = (typeof BUILDING_TYPES)[number]

export const LngLatSchema = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])

export const MAX_ROAD_WIDTH_M = 200

export const MAX_CORNERS = 100

export const RoadWidthSchema = z.number().positive().max(MAX_ROAD_WIDTH_M)

const RoadSchema = z
  .object({
    edge: z.int().nonnegative(),
    widthM: RoadWidthSchema,
    prescribedWidthM: RoadWidthSchema.optional(),
    name: z.string().optional(),
  })
  .refine((road) => road.prescribedWidthM === undefined || road.prescribedWidthM > road.widthM, {
    message: 'a prescribed width widens the road',
    path: ['prescribedWidthM'],
  })

const { plotMaxGfaSqm, plotMaxFar, plotMaxHeightM, plotMaxStoreys, plotMaxSetbackM, plotMaxParkingSqmPerSpace, plotMaxParkingSpacesPerHome, plotMaxHomeSqm } = ASSUMPTIONS

const SetbackSchema = z.number().min(0).max(plotMaxSetbackM.value)

export const PlotLimitsSchema = z.object({
  maxGfaSqm: z.number().positive().max(plotMaxGfaSqm.value).optional(),
  maxFar: z.number().positive().max(plotMaxFar.value).optional(),
  maxHeightM: z.number().positive().max(plotMaxHeightM.value).optional(),
  maxStoreys: z.int().positive().max(plotMaxStoreys.value).optional(),
  maxCoverageShare: z.number().positive().max(1).optional(),
  roadSetbackM: SetbackSchema.optional(),
  boundarySetbackM: SetbackSchema.optional(),
  minOpenSpaceShare: z.number().min(0).lt(1).optional(),
  parkingSqmPerSpace: z.number().positive().max(plotMaxParkingSqmPerSpace.value).optional(),
  parkingSpacesPerHome: z.number().positive().max(plotMaxParkingSpacesPerHome.value).optional(),
  homeSqm: z.number().positive().max(plotMaxHomeSqm.value).optional(),
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
