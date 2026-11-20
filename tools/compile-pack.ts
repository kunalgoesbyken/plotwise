import { z } from 'zod'
import type { SourceCite } from '../src/rules/cite'
import { RulePackSchema, type RulePack } from '../src/rules/pack'
import { lineAt, rawToken, readSource, type Pages } from './pages'
import { COMPARATOR_PHRASES, parseComparator, parseQuantity, thaiSkeleton, unitToMetres, type Comparator } from './quantity'

export type CompileErrorReason =
  | 'malformed'
  | 'source_missing'
  | 'line_missing'
  | 'token_not_on_line'
  | 'unparseable'
  | 'op_missing'
  | 'op_mismatch'
  | 'term_present'
  | 'term_unknown'
  | 'schema'

export type CompileError = { path: string; reason: CompileErrorReason; detail: string }
export type Compiled<T> = { ok: true; value: T } | { ok: false; errors: CompileError[] }

const RefSchema = z.object({
  src: z.string().min(1),
  page: z.int().positive(),
  line: z.int().positive(),
  token: z.string().min(1),
  clause: z.string().min(1),
})
const ValueRefSchema = RefSchema.extend({ unit: z.string().min(1).optional(), unitLine: z.int().positive().optional() })
const BoundRefSchema = ValueRefSchema.extend({ op: z.string().min(1), opLine: z.int().positive().optional() })
const AbsentRefSchema = z.object({
  src: z.string().min(1),
  clause: z.string().min(1),
  from: z.object({ page: z.int().positive(), line: z.int().positive() }),
  to: z.object({ page: z.int().positive(), line: z.int().positive() }),
  term: z.string().min(1),
})

type Ref = z.infer<typeof RefSchema>
type ValueRef = z.infer<typeof ValueRefSchema>
type Sources = Readonly<Record<string, Pages>>

class RefError extends Error {
  constructor(
    readonly reason: CompileErrorReason,
    detail: string,
  ) {
    super(detail)
  }
}

function sourcePages(sources: Sources, src: string): Pages {
  const pages = sources[src]
  if (!pages) throw new RefError('source_missing', `no source "${src}"`)
  return pages
}

function quoteLine(sources: Sources, src: string, page: number, line: number, clause: string): SourceCite {
  const text = lineAt(sourcePages(sources, src), page, line)
  if (text === undefined) throw new RefError('line_missing', `${src} p${page} l${line} does not exist`)
  return { source: src, clause, page, line, quote: text.trim() }
}

function findToken(sources: Sources, ref: Ref, phrase: string): { cite: SourceCite; raw: string } {
  const cite = quoteLine(sources, ref.src, ref.page, ref.line, ref.clause)
  const raw = rawToken(cite.quote, phrase)
  if (raw === undefined) {
    throw new RefError('token_not_on_line', `"${phrase}" is not on ${ref.src} p${ref.page} l${ref.line}: "${cite.quote}"`)
  }
  return { cite, raw }
}

const citeToken = (sources: Sources, ref: Ref): SourceCite => findToken(sources, ref, ref.token).cite

function parseWith<T>(parse: (token: string) => T, token: string): T {
  try {
    return parse(token)
  } catch (error) {
    throw new RefError('unparseable', (error as Error).message)
  }
}

function strictParse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) throw new RefError('malformed', z.prettifyError(parsed.error))
  return parsed.data
}

function readValue(sources: Sources, ref: ValueRef): number {
  const value = parseWith(parseQuantity, findToken(sources, ref, ref.token).raw)
  if (!ref.unit) return value
  const unit = findToken(sources, { ...ref, line: ref.unitLine ?? ref.line }, ref.unit).raw
  return value * parseWith(unitToMetres, unit)
}

function resolveNum(sources: Sources, raw: unknown) {
  const ref = strictParse(ValueRefSchema, raw)
  return { value: readValue(sources, ref), cite: citeToken(sources, ref) }
}

function occurrences(skeletonText: string, phrase: string, token: string): number {
  const needle = thaiSkeleton(`${phrase}${token}`).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const notInsideNumber = /\d$/.test(needle) ? '(?![\\d.])' : ''
  return [...skeletonText.matchAll(new RegExp(`${needle}${notInsideNumber}`, 'g'))].length
}

function comparatorsBefore(text: string, token: string): Comparator[] {
  const skeletonText = thaiSkeleton(text)
  return COMPARATOR_PHRASES.flatMap(([phrase, cmp]) => {
    const longer = COMPARATOR_PHRASES.filter(([other]) => other !== phrase && thaiSkeleton(other).endsWith(thaiSkeleton(phrase)))
    const insideLonger = longer.reduce((sum, [other]) => sum + occurrences(skeletonText, other, token), 0)
    return occurrences(skeletonText, phrase, token) > insideLonger ? [cmp] : []
  })
}

function resolveBound(sources: Sources, raw: unknown) {
  const ref = strictParse(BoundRefSchema, raw)
  const cite = citeToken(sources, ref)
  const text = ref.opLine ? `${quoteLine(sources, ref.src, ref.page, ref.opLine, ref.clause).quote} ${cite.quote}` : cite.quote
  const found = comparatorsBefore(text, ref.token)
  if (found.length === 0) throw new RefError('op_missing', `no comparison word directly before "${ref.token}" on ${ref.src} p${ref.page} l${ref.line}`)
  const cmp = parseWith(parseComparator, ref.op)
  if (!found.includes(cmp)) throw new RefError('op_mismatch', `"${ref.op}" is ${cmp} but the text before "${ref.token}" reads ${found.join(' or ')}`)
  return { value: readValue(sources, ref), cmp, cite }
}

function resolveCite(sources: Sources, raw: unknown) {
  return citeToken(sources, strictParse(RefSchema, raw))
}

type At = { page: number; line: number }
const isAtOrAfter = (a: At, b: At) => a.page > b.page || (a.page === b.page && a.line >= b.line)

function spanText(pages: Pages, from: At, to: At): string {
  return pages
    .flatMap((lines, p) => lines.map((text, l) => ({ page: p + 1, line: l + 1, text })))
    .filter((at) => isAtOrAfter(at, from) && isAtOrAfter(to, at))
    .map((at) => at.text)
    .join('')
}

function resolveAbsent(sources: Sources, raw: unknown) {
  const ref = strictParse(AbsentRefSchema, raw)
  const pages = sourcePages(sources, ref.src)
  const from = quoteLine(sources, ref.src, ref.from.page, ref.from.line, ref.clause)
  const to = quoteLine(sources, ref.src, ref.to.page, ref.to.line, ref.clause)
  const term = thaiSkeleton(ref.term)
  if (!thaiSkeleton(pages.flat().join('')).includes(term)) {
    throw new RefError('term_unknown', `"${ref.term}" never appears in ${ref.src}`)
  }
  if (thaiSkeleton(spanText(pages, ref.from, ref.to)).includes(term)) {
    throw new RefError('term_present', `"${ref.term}" appears between p${ref.from.page} l${ref.from.line} and p${ref.to.page} l${ref.to.line}`)
  }
  return { term: ref.term, from, to }
}

const RESOLVERS: Record<string, (sources: Sources, raw: unknown) => unknown> = {
  $num: resolveNum,
  $bound: resolveBound,
  $cite: resolveCite,
  $absent: resolveAbsent,
}

function resolverOf(node: object): [string, unknown] | undefined {
  const keys = Object.keys(node)
  return keys.length === 1 && keys[0] in RESOLVERS ? [keys[0], (node as Record<string, unknown>)[keys[0]]] : undefined
}

export function compilePointers(pointers: unknown, sources: Sources): Compiled<unknown> {
  const errors: CompileError[] = []
  const walk = (node: unknown, path: string[]): unknown => {
    if (Array.isArray(node)) return node.map((child, i) => walk(child, [...path, String(i)]))
    if (node === null || typeof node !== 'object') return node
    const resolver = resolverOf(node)
    if (!resolver) return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, walk(v, [...path, k])]))
    try {
      return RESOLVERS[resolver[0]](sources, resolver[1])
    } catch (error) {
      if (!(error instanceof RefError)) throw error
      errors.push({ path: path.join('.'), reason: error.reason, detail: error.message })
      return undefined
    }
  }
  const value = walk(pointers, [])
  return errors.length ? { ok: false, errors } : { ok: true, value }
}

export function compilePack(pointers: unknown, sources: Sources): Compiled<RulePack> {
  const compiled = compilePointers(pointers, sources)
  if (!compiled.ok) return compiled
  const parsed = RulePackSchema.safeParse(compiled.value)
  if (parsed.success) return { ok: true, value: parsed.data }
  return {
    ok: false,
    errors: parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), reason: 'schema', detail: issue.message })),
  }
}

const POINTER_SOURCES = z.object({ sources: z.record(z.string(), z.unknown()) })

async function main(packId: string) {
  const root = `${import.meta.dir}/..`
  const pointers: unknown = await Bun.file(`${root}/pointers/${packId}.json`).json()
  const sourceIds = Object.keys(POINTER_SOURCES.parse(pointers).sources)
  const sources = Object.fromEntries(await Promise.all(sourceIds.map(async (id) => [id, await readSource(id)] as const)))
  const result = compilePack(pointers, sources)
  if (!result.ok) {
    result.errors.forEach((e) => console.error(`${e.reason} at ${e.path}: ${e.detail}`))
    process.exit(1)
  }
  await Bun.write(`${root}/src/rules/packs/${packId}.json`, `${JSON.stringify(result.value, null, 2)}\n`)
  console.log(`compiled ${packId} from ${sourceIds.length} sources`)
}

if (import.meta.main) {
  const packId = Bun.argv[2]
  if (!packId) {
    console.error('usage: bun tools/compile-pack.ts <packId>')
    process.exit(1)
  }
  await main(packId)
}
