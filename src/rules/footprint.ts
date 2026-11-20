import { z } from 'zod'
import { CiteSchema, CitedSchema } from './cite'

export const CoverageSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('maxShare'), share: CitedSchema, notes: z.array(CiteSchema) }),
  z.object({ kind: z.literal('plotSpecific') }),
])

export const ReservationSchema = z.object({
  kind: z.literal('roadWidening'),
  targetWidthM: CitedSchema,
  notes: z.array(CiteSchema),
})

export type Coverage = z.infer<typeof CoverageSchema>
export type Reservation = z.infer<typeof ReservationSchema>
