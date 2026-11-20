import { z } from 'zod'
import { CiteSchema } from './cite'

export const QuestionSchema = z
  .object({
    id: z.string().min(1),
    question: z.string().min(1),
    readings: z
      .array(z.object({ id: z.string().min(1), reading: z.string().min(1), cites: z.array(CiteSchema).min(1) }))
      .min(2),
    recommendation: z.string().min(1),
    why: z.string().min(1),
    decision: z.string().nullable(),
  })
  .refine((q) => q.readings.some((r) => r.id === q.recommendation), { message: 'recommendation is not a reading' })
  .refine((q) => q.decision === null || q.readings.some((r) => r.id === q.decision), {
    message: 'decision is not a reading',
  })

export const GapSchema = z.object({ id: z.string().min(1), what: z.string().min(1), why: z.string().min(1) })

export type Question = z.infer<typeof QuestionSchema>
