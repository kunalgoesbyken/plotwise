import type { Check, CheckId, Unit } from '@/designs'
import type { Cite } from '@/rules'
import { formatComparator, formatQuantity, type Quantity } from '@/text/format'
import { t } from '@/text/messages'
import type { AreaUnit } from '@/units/area'

export type CheckStatus = Check['status']

export type CheckRow = {
  readonly id: CheckId
  readonly status: CheckStatus
  readonly cites: readonly Cite[]
  readonly reading: string | null
}

export type CheckTally = Readonly<Record<CheckStatus, number>>

const QUANTITY: Readonly<Record<Exclude<Unit, 'sqm'>, Quantity>> = { m: 'm', ratio: 'ratio', rooms: 'count' }
const SHARES: ReadonlySet<CheckId> = new Set(['front-open-space'])

function quantityOf(check: Extract<Check, { unit: Unit }>, area: AreaUnit): Quantity {
  if (SHARES.has(check.id)) return 'percent'
  return check.unit === 'sqm' ? area : QUANTITY[check.unit]
}

function formatted(value: number, check: Extract<Check, { unit: Unit }>, area: AreaUnit): string {
  const text = formatQuantity(value, quantityOf(check, area))
  return check.unit === 'rooms' ? t('unit.rooms', { number: text }) : text
}

export function checkRow(check: Check, area: AreaUnit): CheckRow {
  const row = { id: check.id, status: check.status, cites: check.cites }
  if (check.status === 'manual') return { ...row, reading: null }
  return { ...row, reading: `${formatted(check.actual, check, area)} ${formatComparator(check.cmp)} ${formatted(check.limit, check, area)}` }
}

export function tally(checks: readonly Check[]): CheckTally {
  const count = (status: CheckStatus) => checks.filter((c) => c.status === status).length
  return { pass: count('pass'), fail: count('fail'), manual: count('manual') }
}
