import { z } from 'zod'

export const ComparatorSchema = z.enum(['lt', 'lte', 'gt', 'gte'])

export const SourceCiteSchema = z.object({
  source: z.string().min(1),
  clause: z.string().min(1),
  page: z.int().positive(),
  line: z.int().positive(),
  quote: z.string().min(1),
})

export const EnteredCiteSchema = z.object({ enteredBy: z.literal('user'), field: z.string().min(1) })

export const CiteSchema = z.union([SourceCiteSchema, EnteredCiteSchema])

export const CitedSchema = z.object({ value: z.number().finite(), cite: CiteSchema })

export const BoundSchema = z.object({ value: z.number().finite(), cmp: ComparatorSchema, cite: CiteSchema })

export const LowerBoundSchema = BoundSchema.extend({ cmp: z.enum(['gt', 'gte']) })
export const UpperBoundSchema = BoundSchema.extend({ cmp: z.enum(['lt', 'lte']) })

export const RangeSchema = z
  .object({ min: LowerBoundSchema.optional(), max: UpperBoundSchema.optional() })
  .refine((r) => !r.min || !r.max || r.min.value < r.max.value, { message: 'empty range' })

export const AbsentTermSchema = z.object({ term: z.string().min(1), from: SourceCiteSchema, to: SourceCiteSchema })

export type Comparator = z.infer<typeof ComparatorSchema>
export type SourceCite = z.infer<typeof SourceCiteSchema>
export type EnteredCite = z.infer<typeof EnteredCiteSchema>
export type Cite = z.infer<typeof CiteSchema>
export type Cited = z.infer<typeof CitedSchema>
export type Bound = z.infer<typeof BoundSchema>
export type Range = z.infer<typeof RangeSchema>
export type AbsentTerm = z.infer<typeof AbsentTermSchema>

export const isSourceCite = (cite: Cite): cite is SourceCite => 'source' in cite

export const enteredCite = (field: string): EnteredCite => ({ enteredBy: 'user', field })

export const entered = (value: number, field: string): Cited => ({ value, cite: enteredCite(field) })

export const enteredBound = (value: number, cmp: Comparator, field: string): Bound => ({ value, cmp, cite: enteredCite(field) })

export function containsEntered(node: unknown): boolean {
  if (Array.isArray(node)) return node.some(containsEntered)
  if (node === null || typeof node !== 'object') return false
  return 'enteredBy' in node || Object.values(node).some(containsEntered)
}
