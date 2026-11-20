import { describe, expect, it } from 'bun:test'
import { plotFromMetres, rectangle } from '@/solve/test-plots'
import { BANGKOK } from '@/rules/test-packs'
import { feasibility } from './compute'

describe('feasibility', () => {
  it('solves the plot and offers at least two designs on a typical lot', () => {
    const result = feasibility(plotFromMetres(rectangle(50, 70), [{ edge: 0, widthM: 16 }]), BANGKOK)
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') return
    expect(result.solution.limits.far.maxGfaSqm).toBeCloseTo(7 * 50 * 70, 0)
    expect(result.designs.length).toBeGreaterThanOrEqual(2)
  })

  it('turns an engine error into a reason the panels can explain', () => {
    const inLine = plotFromMetres(
      [
        [0, 0],
        [10, 0],
        [20, 0],
      ],
      [{ edge: 0, widthM: 8 }],
    )
    expect(feasibility(inLine, BANGKOK)).toEqual({ status: 'failed', reason: 'degenerate' })
  })
})
