import { LOCALE } from './messages'
import { readNumber } from './read-number'

export type Typed = { readonly text: string; readonly caret: number }

const WHOLE = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 })

const PARTS = new Intl.NumberFormat(LOCALE, { useGrouping: true }).formatToParts(1000.5)

const separator = (type: 'group' | 'decimal') => PARTS.find((part) => part.type === type)?.value ?? ''

const GROUP = separator('group')

const DECIMAL = separator('decimal')

const isDigit = (char: string) => char >= '0' && char <= '9'

const digitsIn = (text: string) => [...text].filter(isDigit).join('')

const groupsIn = (text: string) => [...text].filter((char) => char === GROUP).length

const isSignificant = (char: string) => char !== GROUP && char.trim() !== ''

const significantIn = (text: string) => [...text].filter(isSignificant).length

function caretAfter(text: string, significant: number): number {
  let seen = 0
  for (const [index, char] of [...text].entries()) {
    if (seen === significant) return index
    if (isSignificant(char)) seen++
  }
  return text.length
}

function grouped(readable: string): string {
  const trimmed = readable.trim()
  const point = trimmed.indexOf(DECIMAL)
  const whole = digitsIn(point < 0 ? trimmed : trimmed.slice(0, point))
  return whole === '' ? trimmed : `${WHOLE.format(BigInt(whole))}${point < 0 ? '' : trimmed.slice(point)}`
}

const isReadable = (text: string) => readNumber(text).kind === 'number'

const isOurs = (shown: string) => shown === '' || (isReadable(shown) && grouped(shown) === shown)

export function groupTyped(shown: string, typed: string, caret: number): Typed {
  const ungrouped = isOurs(shown) && groupsIn(typed) <= groupsIn(shown) ? typed.replaceAll(GROUP, '') : typed
  if (!isReadable(ungrouped)) return { text: typed, caret }
  const text = grouped(ungrouped)
  return { text, caret: caretAfter(text, significantIn(typed.slice(0, caret))) }
}
