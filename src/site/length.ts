const THAI_DIGIT_ZERO = 0x0e50
const THAI_DIGITS = /[๐-๙]/g

const METRES_PER_FOOT = 0.3048
const METRES_PER_INCH = 0.0254

const NUMBER = '(\\d+(?:[.,]\\d+)?)'
const LENGTH = new RegExp(`^${NUMBER}\\s*([a-z']*)$`)
const FEET_AND_INCHES = new RegExp(`^(\\d+)'\\s*${NUMBER}"?$`)
const POSITIVE_NUMBER = new RegExp(`^${NUMBER}$`)

const METRES_BY_UNIT = new Map<string, number>([
  ['', 1],
  ['m', 1],
  ['meter', 1],
  ['meters', 1],
  ['metre', 1],
  ['metres', 1],
  ['ft', METRES_PER_FOOT],
  ['foot', METRES_PER_FOOT],
  ['feet', METRES_PER_FOOT],
  ["'", METRES_PER_FOOT],
])

function normalise(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(THAI_DIGITS, (digit) => String(digit.charCodeAt(0) - THAI_DIGIT_ZERO))
}

function toNumber(digits: string): number {
  return Number(digits.replace(',', '.'))
}

function positiveOrUndefined(value: number): number | undefined {
  return Number.isFinite(value) && value > 0 ? value : undefined
}

export function parsePositiveNumber(text: string | undefined): number | undefined {
  const match = text === undefined ? null : POSITIVE_NUMBER.exec(normalise(text))
  return match ? positiveOrUndefined(toNumber(match[1])) : undefined
}

export function parseLengthM(text: string | undefined): number | undefined {
  if (text === undefined) return undefined
  const normalised = normalise(text)

  const feetAndInches = FEET_AND_INCHES.exec(normalised)
  if (feetAndInches) {
    const metres = Number(feetAndInches[1]) * METRES_PER_FOOT + toNumber(feetAndInches[2]) * METRES_PER_INCH
    return positiveOrUndefined(metres)
  }

  const length = LENGTH.exec(normalised)
  if (!length) return undefined
  const metresPerUnit = METRES_BY_UNIT.get(length[2])
  return metresPerUnit === undefined ? undefined : positiveOrUndefined(toNumber(length[1]) * metresPerUnit)
}
