import type { Pages } from '../tools/pages'
import { parseQuantity, thaiSkeleton } from '../tools/quantity'
import type { Field, Sources, WriteRun } from './inputs'
import { sameValue } from './metrics'

const PERCENT = thaiSkeleton('ร้อยละ')
const COUNTED_BY = ['เท่า', 'เมตร', 'ชั้น', 'ห้อง', 'คัน'].map(thaiSkeleton)
const LONGEST_NUMBER_WORD = 24
const LAYOUT_GAP = /\s{2,}/g
const DIGITS = /\d+(?:\.\d+)?/g
const RATIO = /(\d+(?:\.\d+)?)(?:ใน|:|ตอ)(\d+(?:\.\d+)?)/g

export function quoteInSource(pages: Pages, quote: string): boolean {
  const needle = thaiSkeleton(quote)
  return needle !== '' && thaiSkeleton(pages.flat().join('')).includes(needle)
}

function parsed(text: string): number | undefined {
  try {
    return parseQuantity(text)
  } catch {
    return undefined
  }
}

function numberAfter(text: string, start: number): number | undefined {
  for (let end = Math.min(text.length, start + LONGEST_NUMBER_WORD); end > start; end--) {
    const value = parsed(text.slice(start, end))
    if (value !== undefined) return value
  }
}

function numberBefore(text: string, end: number): number | undefined {
  for (let start = Math.max(0, end - LONGEST_NUMBER_WORD); start < end; start++) {
    const value = parsed(text.slice(start, end))
    if (value !== undefined) return value
  }
}

function indexesOf(text: string, needle: string): number[] {
  const found: number[] = []
  for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + 1)) found.push(at)
  return found
}

const defined = (value: number | undefined): number[] => (value === undefined ? [] : [value])

function numbersInSkeleton(skeleton: string): number[] {
  const digits = [...skeleton.matchAll(DIGITS)].flatMap(([d]) => [Number(d), Number(d) / 100])
  const ratios = [...skeleton.matchAll(RATIO)].map(([, a, b]) => Number(a) / Number(b))
  const percents = indexesOf(skeleton, PERCENT).flatMap((at) => defined(numberAfter(skeleton, at + PERCENT.length)).map((n) => n / 100))
  const counted = COUNTED_BY.flatMap((unit) => indexesOf(skeleton, unit).flatMap((at) => defined(numberBefore(skeleton, at))))
  return [...digits, ...ratios, ...percents, ...counted]
}

export function valuesIn(lines: readonly string[]): number[] {
  const skeletons = lines.map((line) => thaiSkeleton(line.replace(LAYOUT_GAP, '|')))
  const wrapped = skeletons.slice(1).map((line, i) => skeletons[i] + line)
  return [...new Set([...skeletons, ...wrapped].flatMap(numbersInSkeleton))]
}

export type Grounding = { answered: number; quoteFound: number; valueOnPage: number; valueInQuote: number; ungrounded: string[] }

export function groundRun(run: WriteRun, fields: readonly Field[], sources: Sources): Grounding {
  const checks = fields.flatMap(({ path, source }) => {
    const answer = run.fields[path]
    if (!answer || answer.value === null) return []
    const pages = sources[source]
    if (!pages) throw new Error(`no source text for ${source}`)
    const value = answer.value
    const appearsIn = (lines: readonly string[]) => valuesIn(lines).some((v) => sameValue(path, v, value))
    const page = answer.page === null ? undefined : pages[answer.page - 1]
    return [
      {
        path,
        quoteFound: quoteInSource(pages, answer.quote),
        valueOnPage: page !== undefined && appearsIn(page),
        valueInQuote: appearsIn([answer.quote]),
      },
    ]
  })
  return {
    answered: checks.length,
    quoteFound: checks.filter((c) => c.quoteFound).length,
    valueOnPage: checks.filter((c) => c.valueOnPage).length,
    valueInQuote: checks.filter((c) => c.valueInQuote).length,
    ungrounded: checks.filter((c) => !c.quoteFound || !c.valueOnPage).map((c) => c.path),
  }
}
