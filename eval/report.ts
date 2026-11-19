import { truthValues, type Truth, type TruthEntry } from './inputs'
import { accuracy, agreement, sameValue } from './metrics'
import type { MethodResult, Results } from './score'

const table = (headers: string[], rows: string[][]): string =>
  [headers, headers.map(() => '---'), ...rows].map((cells) => `| ${cells.join(' | ')} |`).join('\n')

const percent = (part: number, whole: number) => (whole === 0 ? '—' : `${Math.round((100 * part) / whole)}%`)
const shown = (value: number | null | undefined) => (value === null || value === undefined ? '—' : String(value))
const truthCell = (entry: TruthEntry | undefined) =>
  !entry ? '—' : 'disputed' in entry ? `disputed: ${truthValues(entry).join(' / ')}` : String(entry.value)

export function renderMethods({ methods }: Results): string {
  return table(
    [
      'Method',
      'Answered',
      'Unresolved',
      'Correct vs truth',
      'Wrong vs truth',
      'Truth fields unresolved',
      'Disputed matched',
      'Ungrounded',
      'Value not in own quote',
      'Errors caught by checks',
    ],
    methods.map(({ name, coverage: c, accuracy: a, grounding, caught }) => [
      name,
      `${c.answered}/${c.total}`,
      String(c.unresolved),
      `${a.correct}/${a.total} (${percent(a.correct, a.correct + a.wrong.length)} of answered)`,
      String(a.wrong.length),
      String(a.unanswered),
      `${a.disputed.matched}/${a.disputed.total}`,
      grounding ? `${grounding.ungrounded.length}/${grounding.answered}` : 'n/a',
      grounding ? `${grounding.answered - grounding.valueInQuote}/${grounding.answered}` : 'n/a',
      String(caught.length),
    ]),
  )
}

function renderPairs({ pairs }: Results): string {
  return table(
    ['Pair', 'Compared', 'Agreed', 'Rate'],
    pairs.map(({ a, b, result }) => [`${a} vs ${b}`, String(result.compared), String(result.agreed), percent(result.agreed, result.compared)]),
  )
}

function renderBySource({ fields, truth, methods }: Results): string {
  const [point, ...writes] = methods
  const sourceIds = [...new Set(fields.map((f) => f.source))]
  const rows = sourceIds.map((id) => {
    const scoped = fields.filter((f) => f.source === id)
    const scopedTruth: Truth = Object.fromEntries(scoped.flatMap(({ path }) => (truth[path] ? [[path, truth[path]]] : [])))
    const correct = methods.map((m) => {
      const a = accuracy(m.answers, scopedTruth)
      return `${a.correct}/${a.total}`
    })
    const agreed = writes.map((w) => {
      const r = agreement(point.answers, w.answers, scoped)
      return `${r.agreed}/${r.compared}`
    })
    return [id, String(scoped.length), String(Object.keys(scopedTruth).length), ...correct, ...agreed]
  })
  const headers = ['Source', 'Fields', 'Truth fields', ...methods.map((m) => `${m.name} correct`), ...writes.map((w) => `point = ${w.name}`)]
  return table(headers, rows)
}

function disagrees(path: string, values: number[]): boolean {
  return values.some((v) => !sameValue(path, v, values[0]))
}

function renderDisagreements({ fields, truth, methods }: Results): string {
  const rows = fields.flatMap(({ path, source }) => {
    const answers = methods.map((m) => m.answers[path] ?? null)
    const entry = truth[path]
    const known = [...answers.filter((v) => v !== null), ...(entry ? truthValues(entry) : [])]
    return disagrees(path, known) ? [[path, source, ...answers.map(shown), truthCell(entry)]] : []
  })
  if (rows.length === 0) return 'None.'
  return table(['Path', 'Source', ...methods.map((m) => m.name), 'Truth'], rows)
}

const bulletList = (lines: string[]) => (lines.length ? lines.map((line) => `- ${line}`).join('\n') : '- none')

function renderCaught(methods: MethodResult[]): string {
  return methods.map(({ name, caught }) => `### ${name}\n\n${bulletList(caught)}`).join('\n\n')
}

function renderUngrounded(methods: MethodResult[]): string {
  return bulletList(methods.flatMap(({ name, grounding }) => (grounding ? [`${name}: ${grounding.ungrounded.join(', ') || 'none'}`] : [])))
}

function renderLimits({ fields, truth, methods }: Results): string {
  const covered = fields.filter((f) => truth[f.path]).length
  const urls = new Set(Object.values(truth).flatMap((entry) => entry.sources.map((s) => s.url)))
  const uncovered = fields.filter((f) => !truth[f.path]).map((f) => f.path)
  const writeRuns = methods.length - 1
  return bulletList([
    `Ground truth comes from secondary published sources (re-published law text on LawPlayer and Longdo, ASA and university PDF copies, Thai real-estate articles), with a verbatim quote for each value. It was not hand-typed by a human from the gazette. The FAR-bonus values come from an article about the draft revision of the plan, used as evidence for the 2556 plan.`,
    `Coverage of the truth set: ${covered} of ${fields.length} fields, from ${urls.size} distinct URLs. Fields with no independent source are scored only by agreement: ${uncovered.join(', ') || 'none'}.`,
    'Ambiguity recall could not be measured fairly: the interpretation questions had already been seen and decided while the pointers were built, so there is no unseen set to recall.',
    `n = ${writeRuns} write run${writeRuns === 1 ? '' : 's'}. Run-to-run agreement is a cheap uncertainty signal, not a confidence interval.`,
    'All methods used the same model family, so their errors may be correlated; agreement between them is weaker evidence than agreement with an outside source.',
    'Values are compared exactly after one normalisation: a share field (path ending in a name containing "share") read above 1 is taken as a percentage and divided by 100. Lengths must be in metres and areas in square metres; nothing else is rescaled. The checks see raw values, so a percentage written as 30 counts as correct against the truth but is still caught by the range check.',
    'The value-on-page check is lenient: it accepts any number on the cited page, its hundredths (for percentages and centimetres), "x in y" ratios and Thai number words before a unit. Small integers appear on almost every page, so "Ungrounded" is a lower bound on hallucination; "Value not in own quote" is the stricter signal.',
    'For "write + check", unresolved write fields keep the pack value, so the checks cannot see errors in fields a run left open. For the point method only the final pointers are compiled; rejections made while the pointers were being written are not recorded.',
  ])
}

export function renderResults(results: Results): string {
  return [
    '# Rule-extraction eval: point vs write',
    'Does making the AI point at source lines (pointers compiled by code) beat having it write the values itself? Generated by `bun eval/score.ts`.',
    '## Methods',
    'point = compiled pack; caught = compile rejections + checkPack. write-n = a classic extraction run; caught = checkPack errors after its values are substituted into the pack (write + check). Ungrounded = answers whose quote is not in the cited source or whose value is not on the cited page. Value not in own quote = answers whose quote does not contain the value given.',
    renderMethods(results),
    '## Agreement',
    renderPairs(results),
    '## By source',
    renderBySource(results),
    '## Errors caught by checks',
    renderCaught(results.methods),
    '## Ungrounded write answers',
    renderUngrounded(results.methods),
    '## Disagreements',
    'Every field where two answered methods differ, or where an answer differs from the truth.',
    renderDisagreements(results),
    '## Limits',
    renderLimits(results),
  ].join('\n\n') + '\n'
}
