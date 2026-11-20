import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import { designs } from '@/designs'
import type { GeometryErrorReason } from '@/geometry'
import { BUILDING_TYPES } from '@/plot/plot'
import { loadPack } from '@/rules'
import { packInterpretations, solve } from '@/solve'
import { plotFromMetres, rectangle } from '@/solve/test-plots'
import { t } from './messages'

const pack = loadPack('bkk-y9')
const readings = packInterpretations(pack)

const REASONS: readonly (GeometryErrorReason | 'unknown')[] = [
  'non-finite',
  'out-of-range',
  'degenerate',
  'self-intersecting',
  'invalid-setbacks',
  'invalid-tiers',
  'invalid-floor-height',
  'invalid-cap',
  'unknown',
]

const lot = fc.record({
  width: fc.integer({ min: 15, max: 200 }),
  depth: fc.integer({ min: 15, max: 200 }),
  road: fc.integer({ min: 4, max: 40 }),
  type: fc.constantFrom(...BUILDING_TYPES),
  nearStation: fc.boolean(),
})

describe('messages', () => {
  it('names every design and check the engine produces, on any plot', () => {
    fc.assert(
      fc.property(lot, ({ width, depth, road, type, nearStation }) => {
        const plot = plotFromMetres(rectangle(width, depth), [{ edge: 0, widthM: road }], type, nearStation)
        for (const design of designs(solve(plot, pack, readings))) {
          expect(t(design.nameKey)).not.toBe('')
          expect(t(`${design.nameKey}.summary`)).not.toBe('')
          for (const check of design.checks) expect(t(`check.${check.id}`)).not.toBe('')
        }
      }),
      { numRuns: 60 },
    )
  })

  it('explains every way the engine can fail, and names every building type', () => {
    for (const reason of REASONS) expect(t(`feasibility.failed.${reason}`)).not.toBe('')
    for (const type of BUILDING_TYPES) expect(t(`building.${type}`)).not.toBe('')
  })

  it('fills parameters and pluralises counts', () => {
    expect(t('plot.corners', { count: 1 })).toBe('1 corner')
    expect(t('plot.corners', { count: 6 })).toBe('6 corners')
    expect(t('unit.sqm', { number: '1,200' })).toBe('1,200\u00a0m²')
    expect(t('source.toggle', { count: 3 })).toBe('Sources (3)')
  })
})
