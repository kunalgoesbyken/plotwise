import { z } from 'zod'
import { CiteSchema, CitedSchema } from './cite'

export const CoverageSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('maxShare'), share: CitedSchema, notes: z.array(CiteSchema) }),
  z.object({ kind: z.literal('plotSpecific'), required: z.boolean() }),
])

const WideningTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('width'), widthM: CitedSchema }),
  z.object({ kind: z.literal('perFrontage'), cite: CiteSchema }),
])

export const ReservationSchema = z.object({
  kind: z.literal('roadWidening'),
  target: WideningTargetSchema,
  farOn: z.enum(['gross', 'net']),
  inLieu: z.object({ multipleOfReserved: CitedSchema, notes: z.array(CiteSchema) }).optional(),
  notes: z.array(CiteSchema),
})

export type Coverage = z.infer<typeof CoverageSchema>
export type Reservation = z.infer<typeof ReservationSchema>
export type WideningTarget = z.infer<typeof WideningTargetSchema>
