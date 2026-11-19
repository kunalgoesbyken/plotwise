import { describe, expect, it } from 'bun:test'
import { EXAMPLE_PLOT } from '@/editor/example-plot'
import { stationDistance } from '@/solve'
import { formatQuantity } from '@/text/format'
import { feasibility, PACK } from './compute'
import { limiterText } from './limiter-text'

function ready(plot = EXAMPLE_PLOT) {
  const result = feasibility(plot)
  if (result.status !== 'ready') throw new Error(`expected a solution, got ${result.reason}`)
  return result
}

describe('limiterText', () => {
  it('names the office-size condition with the road width and station distance from the pack', () => {
    const { solution, designs } = ready({ ...EXAMPLE_PLOT, buildingType: 'office' })
    const office = designs.find((d) => d.limitedBy === 'use')!
    const use = solution.limits.use
    if (use.kind !== 'restricted') throw new Error('expected a restricted use')
    const text = limiterText(office.limitedBy, solution.limits)
    expect(text).toContain(formatQuantity(use.roadWidthM.value, 'm'))
    expect(text).toContain(formatQuantity(stationDistance(PACK).value, 'm'))
  })

  it('names the high-rise threshold height when the building class stops a design', () => {
    const { solution } = ready()
    expect(limiterText('building-class', solution.limits)).toContain(formatQuantity(solution.limits.highRise.fromHeightM.value, 'm'))
  })

  it('has a plain line for every limiter', () => {
    const { solution } = ready()
    for (const limiter of ['far', 'building-class', 'use', 'envelope'] as const) expect(limiterText(limiter, solution.limits)).toMatch(/^Limited by /)
  })
})
