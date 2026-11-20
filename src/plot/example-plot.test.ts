import { describe, expect, it } from 'bun:test'
import { editDraft, emptyDraft, toPlot } from '@/editor/plot-draft'
import { feasibility } from '@/feasibility/compute'
import { isInside } from '@/import/validate'
import { REGIONS } from '@/region/regions'
import { loadPack } from '@/rules'
import { areaToDisplay } from '@/units/area'
import { DUBAI_EXAMPLE_PLOT, MUMBAI_EXAMPLE_PLOT } from './example-plot'

function solved(region: 'mum' | 'dxb') {
  const { example, packId } = REGIONS[region]
  const result = feasibility(example, loadPack(packId))
  if (result.status !== 'ready') throw new Error(`the ${region} example does not solve: ${result.reason}`)
  return result
}

describe('example plots', () => {
  it('lies inside the map bounds of its region', () => {
    for (const { example, bounds } of Object.values(REGIONS)) {
      if (!example || !bounds) continue
      for (const corner of example.ring) expect(isInside(corner, bounds.value)).toBe(true)
    }
  })

  it('opens in the editor exactly as written, so its link is the plot itself', () => {
    for (const { example } of Object.values(REGIONS)) {
      if (!example) continue
      const opened = editDraft(emptyDraft(example.buildingType), { type: 'load-example', plot: example })
      expect(opened.ok && toPlot(opened.draft)).toEqual(example)
    }
  })

  it('gives Mumbai a residential plot of 20,118 sq ft on 5 m roads that solves to designs', () => {
    const { solution, designs } = solved('mum')
    expect(Math.round(areaToDisplay(solution.site.areaSqm, 'sqft'))).toBe(20_118)
    expect(MUMBAI_EXAMPLE_PLOT.roads.map((road) => road.widthM)).toEqual([5, 5])
    expect(MUMBAI_EXAMPLE_PLOT.buildingType).toBe('condo')
    expect(designs.length).toBeGreaterThanOrEqual(2)
  })

  it('gives Dubai a plot whose affection plan allows FAR 3.5 and G+8, and nothing else entered', () => {
    const { solution, designs } = solved('dxb')
    expect(DUBAI_EXAMPLE_PLOT.limits).toEqual({ maxFar: 3.5, maxStoreys: 9 })
    expect(solution.farCap.maxGfaSqm).toBeCloseTo(3.5 * solution.site.areaSqm, 6)
    expect(designs.length).toBeGreaterThanOrEqual(2)
    for (const design of designs) expect(design.metrics.storeys).toBeLessThanOrEqual(9)
  })
})
