import { z } from 'zod'
import { bandsCoverEverything } from './bands'
import { BoundSchema, CiteSchema, CitedSchema, RangeSchema } from './cite'

const PlotSizeRowSchema = z.object({ plotAreaSqm: RangeSchema, ratio: CitedSchema })

const RoadWidthBandSchema = z
  .object({ roadWidthM: RangeSchema, byPlotSize: z.array(PlotSizeRowSchema).min(1) })
  .refine((band) => bandsCoverEverything(band.byPlotSize.map((row) => row.plotAreaSqm)), {
    message: 'plot sizes must run from 0 without gaps to unlimited',
    path: ['byPlotSize'],
  })

export const FarRuleSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('zone'), max: CitedSchema, notes: z.array(CiteSchema) }),
  z.object({
    kind: z.literal('byRoadWidthAndPlotSize'),
    roadWidthBands: z
      .array(RoadWidthBandSchema)
      .min(1)
      .refine((bands) => bandsCoverEverything(bands.map((band) => band.roadWidthM)), {
        message: 'road widths must run from 0 without gaps to unlimited',
      }),
    notes: z.array(CiteSchema),
  }),
  z.object({ kind: z.literal('plotSpecific'), notes: z.array(CiteSchema) }),
])

export const FarBonusSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('affordableHousing'),
    eligible: z.literal('residential'),
    maxShare: CitedSchema,
    maxExtraPerProvidedArea: CitedSchema,
  }),
  z.object({
    kind: z.literal('publicOpenSpace'),
    eligible: z.literal('publicBuilding'),
    zones: CiteSchema,
    maxShare: CitedSchema,
    maxExtraPerProvidedArea: CitedSchema,
    excludesBuildingControlOpenSpace: CiteSchema,
  }),
  z.object({
    kind: z.literal('publicParking'),
    eligible: z.literal('publicBuilding'),
    maxStationDistanceM: BoundSchema,
    maxShare: CitedSchema,
    maxExtraPerSpaceSqm: CitedSchema,
    parkingExemptFromFarAndOsr: CiteSchema,
  }),
  z.object({
    kind: z.literal('floodRetention'),
    eligible: z.literal('anyBuilding'),
    volumeM3: CitedSchema,
    perLandSqm: CitedSchema,
    baseShare: CitedSchema,
    maxShare: CitedSchema,
  }),
  z.object({
    kind: z.literal('energyRating'),
    eligible: z.literal('anyBuilding'),
    levels: z.array(z.object({ level: CitedSchema, share: CitedSchema })).min(1),
  }),
])

export const FarBonusBlockSchema = z.object({ combinedMaxShare: CitedSchema, measures: z.array(FarBonusSchema).min(1) })

const PurchaseCapSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('extraRatio'), ratio: CitedSchema }),
  z.object({ kind: z.literal('shareOfBase'), share: CitedSchema }),
])

const PurchasePriceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('perSqm'), value: CitedSchema }),
  z.object({ kind: z.literal('userSupplied') }),
])

export const FarPurchaseSchema = z.object({
  kind: z.enum(['premium', 'transferableRights', 'fungible']),
  cap: PurchaseCapSchema,
  price: PurchasePriceSchema,
  notes: z.array(CiteSchema),
})

export type FarRule = z.infer<typeof FarRuleSchema>
export type FarBonus = z.infer<typeof FarBonusSchema>
export type FarPurchase = z.infer<typeof FarPurchaseSchema>
