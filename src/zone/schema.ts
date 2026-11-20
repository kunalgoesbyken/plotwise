import { z } from 'zod'
import type { LngLat } from '@/geo/projection'
import { bboxSideLengthsM } from '@/site/bbox'
import { ZONE_MAX_SIDE_M, ZONE_MAX_VERTICES, ZONE_RING_DECIMALS } from './assumptions'

const VERTEX_SEPARATOR = ';'
const COORDINATE_SEPARATOR = ','
const MALFORMED = 'ring must be at least three lng,lat pairs separated by semicolons'

export const UNKNOWN_REASONS = ['no-region', 'no-zone', 'unrecognised', 'unreachable'] as const

const PlanSchema = z.object({ name: z.string().min(1), url: z.url() })

export const ZoneVerdictSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('inside'), zone: z.string().min(1) }),
  z.object({ status: z.literal('outside'), zone: z.string().min(1), covered: z.string().min(1) }),
  z.object({
    status: z.literal('mixed'),
    zones: z.array(z.string().min(1)).min(2),
    covered: z.string().min(1),
  }),
  z.object({ status: z.literal('unknown'), reason: z.enum(UNKNOWN_REASONS), plan: PlanSchema.nullable() }),
])

export const ZoneErrorSchema = z.object({ error: z.string() })

const Coordinate = z.number({ error: MALFORMED })

const VertexSchema = z.tuple([Coordinate.min(-180).max(180), Coordinate.min(-90).max(90)], { error: MALFORMED })

function strictNumber(text: string): number {
  return text.trim() === '' ? Number.NaN : Number(text)
}

export function encodeRing(ring: readonly LngLat[]): string {
  const decimals = ZONE_RING_DECIMALS.value
  return ring.map((vertex) => vertex.map((value) => value.toFixed(decimals)).join(COORDINATE_SEPARATOR)).join(VERTEX_SEPARATOR)
}

function isPlotSized(ring: readonly LngLat[]): boolean {
  const lngs = ring.map(([lng]) => lng)
  const lats = ring.map(([, lat]) => lat)
  const { widthM, heightM } = bboxSideLengthsM([Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)])
  return Math.max(widthM, heightM) <= ZONE_MAX_SIDE_M.value
}

const RingSchema = z
  .array(VertexSchema, { error: MALFORMED })
  .min(3, { error: MALFORMED })
  .max(ZONE_MAX_VERTICES.value)
  .refine(isPlotSized, { error: `ring must fit within ${ZONE_MAX_SIDE_M.value} m on each side`, abort: true })

const parseRing = (text: string) => text.split(VERTEX_SEPARATOR).map((vertex) => vertex.split(COORDINATE_SEPARATOR).map(strictNumber))

export const RingParamSchema = z.string({ error: 'ring is required' }).transform((text, ctx) => {
  const ring = RingSchema.safeParse(parseRing(text))
  if (!ring.success) {
    for (const { message } of ring.error.issues) ctx.addIssue({ code: 'custom', message })
    return z.NEVER
  }
  if (encodeRing(ring.data) !== text) {
    ctx.addIssue({ code: 'custom', message: `ring coordinates must have exactly ${ZONE_RING_DECIMALS.value} decimals` })
    return z.NEVER
  }
  return ring.data
})

export type ZoneVerdict = z.infer<typeof ZoneVerdictSchema>
export type UnknownReason = (typeof UNKNOWN_REASONS)[number]
export type ZonePlan = z.infer<typeof PlanSchema>
