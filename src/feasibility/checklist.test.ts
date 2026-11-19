import { describe, expect, it } from 'bun:test'
import type { Check } from '@/designs'
import type { Cite } from '@/rules'
import { checkRow, tally } from './checklist'

const cite: Cite = { source: 'mr56-bma', clause: 'ข้อ 16', page: 35, line: 8, quote: 'quote' }

const checks: Check[] = [
  { id: 'far', status: 'pass', actual: 19010.09, cmp: 'lte', limit: 19329.6, unit: 'sqm', cites: [cite] },
  { id: 'road-setback', status: 'fail', actual: 1.94, cmp: 'gte', limit: 2, unit: 'm', cites: [cite] },
  { id: 'front-open-space', status: 'pass', actual: 0.5, cmp: 'gt', limit: 0.125, unit: 'ratio', cites: [] },
  { id: 'high-rise-far', status: 'pass', actual: 6.884, cmp: 'lte', limit: 10, unit: 'ratio', cites: [] },
  { id: 'use-size', status: 'fail', actual: 96, cmp: 'lte', limit: 80, unit: 'rooms', cites: [] },
  { id: 'road-access-network', status: 'manual', cites: [cite] },
]

describe('checkRow', () => {
  it('reads each measured check as actual, sign and limit in its own unit', () => {
    expect(checks.map((c) => checkRow(c).reading)).toEqual([
      '19,010 m² ≤ 19,330 m²',
      '1.9 m ≥ 2 m',
      '50% > 12.5%',
      '6.88 ≤ 10',
      '96 rooms ≤ 80 rooms',
      null,
    ])
  })

  it('keeps the status, id and sources of the engine check', () => {
    expect(checkRow(checks[1])).toMatchObject({ id: 'road-setback', status: 'fail', cites: [cite] })
    expect(checkRow(checks[5])).toEqual({ id: 'road-access-network', status: 'manual', cites: [cite], reading: null })
  })
})

describe('tally', () => {
  it('counts passes, fails and checks to verify by hand', () => {
    expect(tally(checks)).toEqual({ pass: 3, fail: 2, manual: 1 })
    expect(tally([])).toEqual({ pass: 0, fail: 0, manual: 0 })
  })
})
