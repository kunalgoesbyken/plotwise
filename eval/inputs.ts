import { z } from 'zod'
import type { Pages } from '../tools/pages'

const FieldSchema = z.object({
  path: z.string().min(1),
  source: z.string().min(1),
  clause: z.string().min(1),
  page: z.int().positive(),
})

export const FieldsSchema = z.object({ pack: z.string().min(1), fields: z.array(FieldSchema).min(1) })

const TruthSourceSchema = z.object({
  url: z.url(),
  title: z.string().min(1),
  quote: z.string().min(1),
  note: z.string().min(1).optional(),
})

const AgreedTruthSchema = z.object({ value: z.number().finite(), sources: z.array(TruthSourceSchema).min(1) }).strict()

const DisputedTruthSchema = z
  .object({ disputed: z.literal(true), sources: z.array(TruthSourceSchema.extend({ value: z.number().finite() })).min(2) })
  .strict()
  .refine((t) => new Set(t.sources.map((s) => s.value)).size > 1, { message: 'a disputed field needs sources that disagree' })

export const TruthSchema = z.record(z.string(), z.union([AgreedTruthSchema, DisputedTruthSchema]))

export const WriteRunSchema = z.object({
  fields: z.record(
    z.string(),
    z.object({ value: z.number().finite().nullable(), page: z.int().positive().nullable(), quote: z.string() }),
  ),
})

export type Field = z.infer<typeof FieldSchema>
export type Truth = z.infer<typeof TruthSchema>
export type TruthEntry = Truth[string]
export type WriteRun = z.infer<typeof WriteRunSchema>
export type NamedRun = { name: string; run: WriteRun }
export type Answers = Readonly<Record<string, number | null>>
export type Sources = Readonly<Record<string, Pages>>

export const truthValues = (entry: TruthEntry): number[] =>
  'disputed' in entry ? [...new Set(entry.sources.map((s) => s.value))] : [entry.value]
