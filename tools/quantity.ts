export type Comparator = 'lt' | 'lte' | 'gt' | 'gte'

const THAI_MARKS = /[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\s]/g
const THAI_DIGIT_ZERO = 0x0e50

export function thaiSkeleton(text: string): string {
  return text
    .replace(THAI_MARKS, '')
    .replace(/\u0E33/g, '\u0E32')
    .replace(/[\u0E50-\u0E59]/g, (d) => String(d.charCodeAt(0) - THAI_DIGIT_ZERO))
    .replace(/,/g, '')
    .toLowerCase()
}

const WORD_DIGITS: readonly (readonly [string, number])[] = [
  ['ศนย', 0],
  ['หนง', 1],
  ['สอง', 2],
  ['สาม', 3],
  ['หก', 6],
  ['เจด', 7],
  ['แปด', 8],
  ['เกา', 9],
  ['หา', 5],
  ['ส', 4],
]
const TEN = 'สบ'
const TWENTY_PREFIX = 'ย'
const UNIT_ONE = 'เอด'
const POINT = 'จด'
const WORDS = [TEN, UNIT_ONE, POINT, TWENTY_PREFIX, ...WORD_DIGITS.map(([w]) => w)].sort((a, b) => b.length - a.length)

function tokenizeWords(skeleton: string): string[] {
  const tokens: string[] = []
  let rest = skeleton
  while (rest) {
    const word = WORDS.find((w) => rest.startsWith(w))
    if (!word) throw new Error(`not a Thai number: ${skeleton}`)
    tokens.push(word)
    rest = rest.slice(word.length)
  }
  return tokens
}

const digitOf = (word: string | undefined): number | undefined => WORD_DIGITS.find(([w]) => w === word)?.[1]

function singleDigit(tokens: string[], min: number): number | undefined {
  const digit = tokens.length === 1 ? digitOf(tokens[0]) : undefined
  return digit !== undefined && digit >= min ? digit : undefined
}

function tensDigit(tokens: string[]): number | undefined {
  if (tokens.length === 0) return 1
  if (tokens.length === 1 && tokens[0] === TWENTY_PREFIX) return 2
  return singleDigit(tokens, 3)
}

function unitsDigit(tokens: string[]): number | undefined {
  if (tokens.length === 0) return 0
  if (tokens.length === 1 && tokens[0] === UNIT_ONE) return 1
  return singleDigit(tokens, 2)
}

const combineTens = (tens: number | undefined, units: number | undefined) =>
  tens === undefined || units === undefined ? undefined : tens * 10 + units

function parseIntegerWords(tokens: string[]): number {
  const tenAt = tokens.indexOf(TEN)
  const value =
    tenAt === -1
      ? singleDigit(tokens, 0)
      : combineTens(tensDigit(tokens.slice(0, tenAt)), unitsDigit(tokens.slice(tenAt + 1)))
  if (value === undefined) throw new Error(`not a Thai number: ${tokens.join('')}`)
  return value
}

function parseWords(skeleton: string): number {
  const tokens = tokenizeWords(skeleton)
  const pointAt = tokens.indexOf(POINT)
  if (pointAt === -1) return parseIntegerWords(tokens)
  const decimals = tokens.slice(pointAt + 1).map(digitOf)
  if (decimals.length === 0 || decimals.some((d) => d === undefined)) throw new Error(`not a Thai number: ${skeleton}`)
  return Number(`${parseIntegerWords(tokens.slice(0, pointAt))}.${decimals.join('')}`)
}

const ENGLISH_NUMBERS: Readonly<Record<string, number>> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
}

function parseNumber(skeleton: string): number {
  if (/^\d+(\.\d+)?$/.test(skeleton)) return Number(skeleton)
  if (!skeleton) throw new Error('empty number')
  return ENGLISH_NUMBERS[skeleton] ?? parseWords(skeleton)
}

const UNITS = ['ลูกบาศก์เมตร', 'ตารางเมตร', 'เมตร', 'ห้อง', 'ชั้น', 'คัน'].map(thaiSkeleton)

const withoutUnit = (skeleton: string) => {
  const unit = UNITS.find((u) => skeleton.endsWith(u) && skeleton.length > u.length)
  return unit ? skeleton.slice(0, -unit.length) : skeleton
}

const ORDINAL = 'ท'
const PERCENT = 'รอยละ'
const PERCENT_AFTER = ['%', 'percent']
const TIMES = ['เทา', 'times']

const suffix = (s: string, endings: readonly string[]) => endings.find((ending) => s.endsWith(ending) && s.length > ending.length)

export function parseQuantity(token: string): number {
  const s = withoutUnit(thaiSkeleton(token))
  if (s.startsWith(PERCENT)) return parseNumber(s.slice(PERCENT.length)) / 100
  const percent = suffix(s, PERCENT_AFTER)
  if (percent) return parseNumber(s.slice(0, -percent.length)) / 100
  const times = suffix(s, TIMES)
  if (times) return parseNumber(s.slice(0, -times.length))
  if (s.startsWith(ORDINAL)) return parseNumber(s.slice(ORDINAL.length))
  const pair = /^(\d+(?:\.\d+)?)(ใน|:|ตอ|\/)(\d+(?:\.\d+)?)$/.exec(s)
  if (pair) return Number(pair[1]) / Number(pair[3])
  return parseNumber(s)
}

const METRES_PER_UNIT: Record<string, number> = {
  [thaiSkeleton('เมตร')]: 1,
  [thaiSkeleton('เซนติเมตร')]: 0.01,
  m: 1,
}

export function unitToMetres(token: string): number {
  const factor = METRES_PER_UNIT[thaiSkeleton(token)]
  if (factor === undefined) throw new Error(`not a length unit: ${token}`)
  return factor
}

export type ComparatorSide = 'before' | 'after'

export const COMPARATOR_PHRASES: readonly (readonly [string, Comparator, ComparatorSide])[] = [
  ['ไม่น้อยกว่า', 'gte', 'before'],
  ['ไม่ต่ำกว่า', 'gte', 'before'],
  ['ตั้งแต่', 'gte', 'before'],
  ['ไม่เกิน', 'lte', 'before'],
  ['เกิน', 'gt', 'before'],
  ['น้อยกว่า', 'lt', 'before'],
  ['ไม่ถึง', 'lt', 'before'],
  ['ภายในระยะ', 'lte', 'before'],
  ['มากกว่า', 'gt', 'before'],
  ['less than', 'lt', 'before'],
  ['up to', 'lte', 'before'],
  ['not exceeding', 'lte', 'before'],
  ['exceeding', 'gt', 'before'],
  ['more than', 'gt', 'before'],
  ['wider than', 'gt', 'before'],
  ['& above', 'gte', 'after'],
  ['and above', 'gte', 'after'],
]

const COMPARATORS = new Map(COMPARATOR_PHRASES.map(([phrase, cmp, side]) => [thaiSkeleton(phrase), { cmp, side }]))

function comparatorOf(token: string) {
  const comparator = COMPARATORS.get(thaiSkeleton(token))
  if (!comparator) throw new Error(`not a comparison word: ${token}`)
  return comparator
}

export const parseComparator = (token: string): Comparator => comparatorOf(token).cmp

export const comparatorSide = (token: string): ComparatorSide => comparatorOf(token).side
