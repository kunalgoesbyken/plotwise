import { basename } from 'node:path'
import { RulePackSchema, type RulePack } from '../src/rules/types'
import { checkPack } from '../tools/check-pack'
import { compilePack } from '../tools/compile-pack'
import { readSource } from '../tools/pages'
import { groundRun, type Grounding } from './grounding'
import { FieldsSchema, TruthSchema, WriteRunSchema, type Answers, type Field, type NamedRun, type Sources, type Truth } from './inputs'
import { accuracy, agreement, coverage, invariantErrors, pointAnswers, writeAnswers, type Accuracy, type Agreement, type Coverage } from './metrics'
import { renderMethods, renderResults } from './report'

export type MethodResult = {
  name: string
  answers: Answers
  coverage: Coverage
  accuracy: Accuracy
  caught: string[]
  grounding: Grounding | null
}
export type PairResult = { a: string; b: string; result: Agreement }
export type Results = { fields: readonly Field[]; truth: Truth; methods: MethodResult[]; pairs: PairResult[] }
export type ScoreInput = {
  fields: readonly Field[]
  truth: Truth
  pack: RulePack
  compileErrors: string[]
  runs: readonly NamedRun[]
  sources: Sources
}

export function score({ fields, truth, pack, compileErrors, runs, sources }: ScoreInput): Results {
  const method = (name: string, answers: Answers, caught: string[], grounding: Grounding | null): MethodResult => ({
    name,
    answers,
    coverage: coverage(answers, fields),
    accuracy: accuracy(answers, truth),
    caught,
    grounding,
  })
  const point = method('point', pointAnswers(pack, fields), [...compileErrors, ...checkPack(pack).errors], null)
  const writes = runs.map(({ name, run }) => {
    const answers = writeAnswers(run, fields)
    return method(name, answers, invariantErrors(pack, answers), groundRun(run, fields, sources))
  })
  const pair = (a: MethodResult, b: MethodResult): PairResult => ({ a: a.name, b: b.name, result: agreement(a.answers, b.answers, fields) })
  return {
    fields,
    truth,
    methods: [point, ...writes],
    pairs: [...writes.map((w) => pair(point, w)), ...writes.flatMap((w, i) => writes.slice(i + 1).map((v) => pair(w, v)))],
  }
}

const ROOT = `${import.meta.dir}/..`
const json = async (path: string): Promise<unknown> => Bun.file(`${ROOT}/${path}`).json()

async function loadRuns(): Promise<NamedRun[]> {
  const files = [...new Bun.Glob('eval/runs/*.json').scanSync(ROOT)].sort()
  return Promise.all(
    files.map(async (file) => {
      const parsed = WriteRunSchema.safeParse(await json(file))
      if (!parsed.success) throw new Error(`${file} is not a write run: ${parsed.error.message}`)
      return { name: basename(file, '.json'), run: parsed.data }
    }),
  )
}

async function main() {
  const { pack: packId, fields } = FieldsSchema.parse(await json('eval/fields.json'))
  const truth = TruthSchema.parse(await json(`eval/ground-truth/${packId}.json`))
  const pack = RulePackSchema.parse(await json(`src/rules/packs/${packId}.json`))
  const sourceIds = [...new Set([...Object.keys(pack.sources), ...fields.map((f) => f.source)])]
  const sources = Object.fromEntries(await Promise.all(sourceIds.map(async (id) => [id, await readSource(id)] as const)))
  const compiled = compilePack(await json(`pointers/${packId}.json`), sources)
  const compileErrors = compiled.ok ? [] : compiled.errors.map((e) => `${e.reason} at ${e.path}: ${e.detail}`)
  const results = score({ fields, truth, pack, compileErrors, runs: await loadRuns(), sources })
  console.log(renderMethods(results))
  await Bun.write(`${ROOT}/eval/RESULTS.md`, renderResults(results))
  console.log('wrote eval/RESULTS.md')
}

if (import.meta.main) await main()
