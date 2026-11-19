import type { Check, CheckId, Unit } from '@/designs'
import type { Cite } from '@/rules'
import { formatComparator, formatQuantity, type Quantity } from '@/text/format'
import { t } from '@/text/messages'

export type CheckStatus = Check['status']

export type CheckRow = {
  readonly id: CheckId
  readonly status: CheckStatus
  readonly cites: readonly Cite[]
  readonly reading: string | null
}

export type CheckTally = Readonly<Record<CheckStatus, number>>

const QUANTITY: Readonly<Record<Unit, Quantity>> = { sqm: 'sqm', m: 'm', ratio: 'ratio', rooms: 'count' }
const SHARES: ReadonlySet<CheckId> = new Set(['front-open-space'])

function quantityOf(check: Extract<Check, { unit: Unit }>): Quantity {
  return SHARES.has(check.id) ? 'percent' : QUANTITY[check.unit]
}

function formatted(value: number, check: Extract<Check, { unit: Unit }>): string {
  const text = formatQuantity(value, quantityOf(check))
  return check.unit === 'rooms' ? t('unit.rooms', { number: text }) : text
}

export function checkRow(check: Check): CheckRow {
  const row = { id: check.id, status: check.status, cites: check.cites }
  if (check.status === 'manual') return { ...row, reading: null }
  return { ...row, reading: `${formatted(check.actual, check)} ${formatComparator(check.cmp)} ${formatted(check.limit, check)}` }
}

export function tally(checks: readonly Check[]): CheckTally {
  const count = (status: CheckStatus) => checks.filter((c) => c.status === status).length
  return { pass: count('pass'), fail: count('fail'), manual: count('manual') }
}
