import { z } from 'zod'
import { isSourceCite, type Cite, type Membership, type RulePack } from '@/rules'
import { DEFAULT_READINGS } from './assumptions'

export const InterpretationsSchema = z.object({
  'hotel-residential': z.enum(['public-building', 'residential']),
  'condo-public-building': z.enum(['not-public', 'public']),
  'office-public-building': z.enum(['not-public', 'public']),
  'open-space-base': z.enum(['all-stricter', 'ministerial-only']),
  'parking-source': z.enum(['bylaw', 'ministerial', 'higher-of-both']),
  'permeable-base': z.enum(['required', 'provided']),
  'gfa-includes-parking': z.enum(['counts', 'excluded']),
  'office-operating-area': z.enum(['gfa', 'net']),
  'road-access-tiers': z.enum(['frontage-and-row', 'row-only']),
  'bylaw-2569-scope': z.enum(['factories-only', 'unverified']),
  'front-open-space': z.enum(['exempt-on-road', 'always']),
})

export type Interpretations = z.infer<typeof InterpretationsSchema>
export type QuestionId = keyof Interpretations

const MEMBER_READING = {
  'hotel-residential': 'residential',
  'condo-public-building': 'public',
  'office-public-building': 'public',
} as const satisfies Partial<Interpretations>

type ClassQuestion = keyof typeof MEMBER_READING

const DEFAULTS = Object.fromEntries(Object.entries(DEFAULT_READINGS).map(([id, { value }]) => [id, value]))

export function packInterpretations(pack: RulePack): Interpretations {
  const undecided = pack.questions.filter((q) => q.decision === null).map((q) => q.id)
  if (undecided.length) throw new Error(`the pack has undecided questions: ${undecided.join(', ')}`)
  return InterpretationsSchema.parse({ ...DEFAULTS, ...Object.fromEntries(pack.questions.map((q) => [q.id, q.decision])) })
}

export const posesQuestion = (pack: RulePack, questionId: QuestionId) => pack.questions.some((q) => q.id === questionId)

export function readingCites(pack: RulePack, questionId: QuestionId, readingId: string): readonly Cite[] {
  const question = pack.questions.find((q) => q.id === questionId)
  if (!question) return []
  const reading = question.readings.find((r) => r.id === readingId)
  if (!reading) throw new Error(`the pack has no reading ${readingId} for question ${questionId}`)
  return reading.cites
}

export function readingSources(pack: RulePack, questionId: QuestionId, readingId: string): ReadonlySet<string> {
  return new Set(readingCites(pack, questionId, readingId).filter(isSourceCite).map((c) => c.source))
}

const isClassQuestion = (id: string): id is ClassQuestion => id in MEMBER_READING

export function isMember(
  pack: RulePack,
  membership: Membership,
  readings: Interpretations,
): { readonly member: boolean; readonly cites: readonly Cite[] } {
  if (membership.kind === 'stated') return { member: membership.member, cites: [membership.cite] }
  const { questionId } = membership
  if (!isClassQuestion(questionId)) throw new Error(`the engine has no reading for class question ${questionId}`)
  const reading = readings[questionId]
  return { member: reading === MEMBER_READING[questionId], cites: readingCites(pack, questionId, reading) }
}
