import { thaiSkeleton } from './quantity'

export type Pages = readonly (readonly string[])[]
export type LineHit = { page: number; line: number; text: string }

export function splitPages(text: string): Pages {
  const segments = text.replace(/\r\n/g, '\n').split('\f')
  const pages = segments.at(-1) === '' ? segments.slice(0, -1) : segments
  return pages.map((page) => page.split('\n'))
}

export function lineAt(pages: Pages, page: number, line: number): string | undefined {
  return pages[page - 1]?.[line - 1]
}

export function findLines(pages: Pages, text: string): LineHit[] {
  const needle = thaiSkeleton(text)
  return pages.flatMap((lines, p) =>
    lines.flatMap((line, l) => (thaiSkeleton(line).includes(needle) ? [{ page: p + 1, line: l + 1, text: line }] : [])),
  )
}

const isDropped = (ch: string) => thaiSkeleton(ch) === ''
const isNumeric = (ch: string | undefined) => ch !== undefined && (ch === ',' || /^[\d.]$/.test(thaiSkeleton(ch)))
const isDigit = (ch: string | undefined) => ch !== undefined && /^\d$/.test(thaiSkeleton(ch))
const continuesNumber = (chars: string[], at: number) => isNumeric(chars[at]) && (chars[at] !== '.' || isDigit(chars[at + 1]))
const DIGIT_AT_START = /^\d/
const DIGIT_AT_END = /\d$/

function matchFrom(chars: string[], start: number, target: string): string | undefined {
  let end = start
  let skeleton = ''
  while (end < chars.length && skeleton.length < target.length) skeleton += thaiSkeleton(chars[end++])
  if (skeleton !== target) return undefined
  if (DIGIT_AT_START.test(target) && isNumeric(chars[start - 1])) return undefined
  if (DIGIT_AT_END.test(target) && continuesNumber(chars, end)) return undefined
  while (end < chars.length && chars[end] !== ' ' && isDropped(chars[end])) end++
  return chars.slice(start, end).join('')
}

export function rawToken(line: string, phrase: string): string | undefined {
  const target = thaiSkeleton(phrase)
  const chars = [...line]
  return chars
    .map((ch, start) => (isDropped(ch) ? undefined : matchFrom(chars, start, target)))
    .filter((match) => match !== undefined)
    .reduce<string | undefined>((best, match) => (best === undefined || match.length < best.length ? match : best), undefined)
}

export async function readSource(sourceId: string): Promise<Pages> {
  return splitPages(await Bun.file(`${import.meta.dir}/../sources/${sourceId}.txt`).text())
}

function printPage(pages: Pages, page: number) {
  const lines = pages[page - 1]
  if (!lines) throw new Error(`no page ${page}`)
  lines.forEach((line, i) => console.log(`${String(i + 1).padStart(3)}| ${line}`))
}

if (import.meta.main) {
  const [sourceId, mode, ...needles] = Bun.argv.slice(2)
  if (!sourceId || !mode) {
    console.error('usage: bun tools/pages.ts <sourceId> <page> | bun tools/pages.ts <sourceId> --find <text>...')
    process.exit(1)
  }
  const pages = await readSource(sourceId)
  if (mode !== '--find') printPage(pages, Number(mode))
  for (const needle of mode === '--find' ? needles : []) {
    console.log(`## ${needle}`)
    findLines(pages, needle).forEach((hit) => console.log(`p${hit.page} l${hit.line}| ${hit.text}`))
  }
}
