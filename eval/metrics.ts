import type { RulePack } from '../src/rules'
import { checkPack } from '../tools/check-pack'
import { truthValues, type Answers, type Field, type Truth, type TruthEntry, type WriteRun } from './inputs'

const segments = (path: string) => path.replace(/\[(\d+)\]/g, '.$1').split('.')

const isShare = (path: string) => /share/i.test(segments(path).findLast((s) => !/^\d+$/.test(s)) ?? '')

const asFraction = (path: string, value: number) => (isShare(path) && value > 1 ? value / 100 : value)

export function sameValue(path: string, a: number, b: number): boolean {
  const [x, y] = [asFraction(path, a), asFraction(path, b)]
  return Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(x), Math.abs(y))
}

type Node = Record<string, unknown>
type Holder = { value: number }

const isNode = (v: unknown): v is Node => typeof v === 'object' && v !== null
const isHolder = (v: unknown): v is Holder => isNode(v) && typeof v.value === 'number'

function holderAt(root: unknown, path: string): Holder | undefined {
  const node = segments(path).reduce<unknown>((n, key) => (isNode(n) ? n[key] : undefined), root)
  return isHolder(node) ? node : undefined
}

export const valueAt = (pack: RulePack, path: string): number | null => holderAt(pack, path)?.value ?? null

export function withValues(pack: RulePack, answers: Answers): RulePack {
  const copy = structuredClone(pack)
  for (const [path, value] of Object.entries(answers)) {
    if (value === null) continue
    const holder = holderAt(copy, path)
    if (!holder) throw new Error(`the pack has no value at ${path}`)
    holder.value = value
  }
  return copy
}

const answerOf = (answers: Answers, path: string) => answers[path] ?? null

export const pointAnswers = (pack: RulePack, fields: readonly Field[]): Answers =>
  Object.fromEntries(fields.map(({ path }) => [path, valueAt(pack, path)]))

export const writeAnswers = (run: WriteRun, fields: readonly Field[]): Answers =>
  Object.fromEntries(fields.map(({ path }) => [path, run.fields[path]?.value ?? null]))

export type Coverage = { total: number; answered: number; unresolved: number }

export function coverage(answers: Answers, fields: readonly Field[]): Coverage {
  const answered = fields.filter(({ path }) => answerOf(answers, path) !== null).length
  return { total: fields.length, answered, unresolved: fields.length - answered }
}

export type Accuracy = { total: number; correct: number; wrong: string[]; unanswered: number; disputed: { total: number; matched: number } }

export function accuracy(answers: Answers, truth: Truth): Accuracy {
  const entries = Object.entries(truth)
  const matches = ([path, entry]: [string, TruthEntry]) => {
    const answer = answerOf(answers, path)
    return answer !== null && truthValues(entry).some((v) => sameValue(path, answer, v))
  }
  const agreed = entries.filter(([, entry]) => !('disputed' in entry))
  const disputed = entries.filter(([, entry]) => 'disputed' in entry)
  const answered = agreed.filter(([path]) => answerOf(answers, path) !== null)
  return {
    total: agreed.length,
    correct: answered.filter(matches).length,
    wrong: answered.filter((entry) => !matches(entry)).map(([path]) => path),
    unanswered: agreed.length - answered.length,
    disputed: { total: disputed.length, matched: disputed.filter(matches).length },
  }
}

export type Agreement = { compared: number; agreed: number; differing: string[] }

export function agreement(a: Answers, b: Answers, fields: readonly Field[]): Agreement {
  const compared = fields.flatMap(({ path }) => {
    const [x, y] = [answerOf(a, path), answerOf(b, path)]
    return x === null || y === null ? [] : [{ path, same: sameValue(path, x, y) }]
  })
  const differing = compared.filter((c) => !c.same).map((c) => c.path)
  return { compared: compared.length, agreed: compared.length - differing.length, differing }
}

export const invariantErrors = (pack: RulePack, answers: Answers): string[] => checkPack(withValues(pack, answers)).errors
