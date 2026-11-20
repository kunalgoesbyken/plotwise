import { MAX_CORNERS } from '@/plot/plot'
import { ASSUMPTIONS } from '@/solve'
import { locate } from './georef'
import { shapeOf } from './shape'
import {
  fail,
  failEntry,
  succeed,
  type DegreeOrder,
  type Georef,
  type Pair,
  type Question,
  type Result,
  type Source,
  type UtmOrder,
} from './types'
import { MAX_UTM_EASTING_M, MIN_UTM_EASTING_M } from './utm'
import { isInside, isOnEarth, type Bounds } from './validate'

const DEGREE_ORDERS: readonly DegreeOrder[] = ['lng-lat', 'lat-lng']
const UTM_ORDERS: readonly UtmOrder[] = ['east-north', 'north-east']
const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙'
const MAX_DEGREES = 180

const asciiDigits = (text: string) => text.replace(/[๐-๙]/g, (digit) => String(THAI_DIGITS.indexOf(digit)))

function readEntry(entry: string): Pair | null {
  const numbers = entry.split(/[\s,]+/).filter(Boolean).map(Number)
  if (numbers.length < 2 || numbers.length > 3 || !numbers.every(Number.isFinite)) return null
  return [numbers[0], numbers[1]]
}

function isJoinedPair(word: string) {
  const numbers = word.split(',')
  return numbers.length > 1 && numbers.every((number) => number !== '')
}

function splitJoinedPairs(line: string): string[] {
  const words = line.trim().split(/\s+/)
  return words.length > 1 && words.every(isJoinedPair) ? words : [line]
}

function readEntries(text: string): Result<Pair[]> {
  if (text.length > ASSUMPTIONS.importMaxPasteChars.value) return fail('paste-too-large')
  const entries = asciiDigits(text)
    .split(/[\r\n;]+/)
    .filter((entry) => entry.trim() !== '')
    .flatMap(splitJoinedPairs)
  if (entries.length > MAX_CORNERS + 1) return fail('too-many-corners')
  const points: Pair[] = []
  for (const [index, entry] of entries.entries()) {
    const point = readEntry(entry)
    if (!point) return failEntry(index + 1)
    points.push(point)
  }
  return points.length === 0 ? fail('too-few-corners') : succeed(points)
}

function degreesQuestion(points: readonly Pair[], bounds: Bounds): Result<Question> {
  const lands = (order: DegreeOrder, where: (at: readonly [number, number]) => boolean) =>
    locate(points, { kind: 'degrees', order } satisfies Georef).every(where)
  const orders = DEGREE_ORDERS.filter((order) => lands(order, (at) => isInside(at, bounds)))
  if (orders.length > 0) return succeed({ kind: 'degrees', orders })
  return fail(DEGREE_ORDERS.some((order) => lands(order, isOnEarth)) ? 'outside-region' : 'out-of-range')
}

const isEasting = (metres: number) => metres >= MIN_UTM_EASTING_M && metres <= MAX_UTM_EASTING_M

function utmQuestion(points: readonly Pair[]): Result<Question> {
  const orders = UTM_ORDERS.filter((order) => points.every((point) => isEasting(point[order === 'east-north' ? 0 : 1])))
  return orders.length > 0 ? succeed({ kind: 'utm', orders }) : fail('unrecognised-coordinates')
}

function classify(points: readonly Pair[], bounds: Bounds): Result<Question> {
  const values = points.flat()
  if (values.every((value) => Math.abs(value) <= MAX_DEGREES)) return degreesQuestion(points, bounds)
  if (values.every((value) => Math.abs(value) > MAX_DEGREES)) return utmQuestion(points)
  return fail('unrecognised-coordinates')
}

export function parsePasted(text: string, bounds: Bounds): Result<Source> {
  const entries = readEntries(text)
  if (!entries.ok) return entries
  const question = classify(entries.value, bounds)
  if (!question.ok) return question
  return succeed({ shapes: [shapeOf(null, entries.value, true)], question: question.value })
}
