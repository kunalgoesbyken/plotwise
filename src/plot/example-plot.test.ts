import { describe, expect, it } from 'bun:test'
import { editDraft, emptyDraft, toPlot } from '@/editor/plot-draft'
import { feasibility } from '@/feasibility/compute'
import { isInside } from '@/import/validate'
import { isExampleSite, REGIONS } from '@/region/regions'
import { loadPack } from '@/rules'
import fixture from '@/site/__fixtures__/mulund-west.overpass.json'
import { nearestRoad } from '@/site/nearest-road'
import { OverpassResponseSchema } from '@/site/overpass-response'
import { parseOverpass } from '@/site/parse'
import { DUBAI_EXAMPLE_PLOT, MUMBAI_EXAMPLE_LAND_RATE, MUMBAI_EXAMPLE_PLOT } from './example-plot'

function solved(region: 'mum' | 'dxb') {
  const { example, packId } = REGIONS[region]
  const result = feasibility(example.plot, loadPack(packId))
  if (result.status !== 'ready') throw new Error(`the ${region} example does not solve: ${result.reason}`)
  return result
}

const offered = (region: 'mum' | 'dxb') =>
  Object.fromEntries(solved(region).solution.limits.farPurchase.options.map((option) => [option.kind, option.maxExtraGfaSqm]))

describe('example plots', () => {
  it('lies inside the map bounds of its region', () => {
    for (const { example, bounds } of Object.values(REGIONS)) {
      if (!example || !bounds) continue
      for (const corner of example.plot.ring) expect(isInside(corner, bounds.value)).toBe(true)
    }
  })

  it('opens in the editor exactly as written, so its link is the plot itself', () => {
    for (const { example } of Object.values(REGIONS)) {
      if (!example) continue
      const opened = editDraft(emptyDraft(example.plot.buildingType), { type: 'load-example', example })
      expect(opened.ok && toPlot(opened.draft)).toEqual(example.plot)
    }
  })

  it('gives the Mumbai example the road widths Plotwise itself estimates from OpenStreetMap, and loads them marked as estimates', () => {
    const { roads } = parseOverpass(OverpassResponseSchema.parse(fixture), REGIONS.mum.transit)
    const { ring } = MUMBAI_EXAMPLE_PLOT
    for (const road of MUMBAI_EXAMPLE_PLOT.roads) {
      expect(nearestRoad([ring[road.edge], ring[(road.edge + 1) % ring.length]], roads)?.widthM).toBe(road.widthM)
    }
    for (const { example } of Object.values(REGIONS)) {
      if (!example) continue
      const opened = editDraft(emptyDraft(example.plot.buildingType), { type: 'load-example', example })
      const roadEdges = opened.ok && opened.draft.status === 'closed' ? opened.draft.corners.flatMap(({ edge }) => (edge.road ? [edge] : [])) : []
      expect(roadEdges.length).toBe(example.plot.roads.length)
      for (const edge of roadEdges) expect(edge.estimated).toBe(example.roadsEstimated)
    }
    expect(REGIONS.mum.example.roadsEstimated).toBe(true)
  })

  it('gives Mumbai a residential plot of a few thousand m² whose main road is 12 to 18 m wide, so Premium FSI and TDR are offered', () => {
    const { solution, designs } = solved('mum')
    expect(solution.site.areaSqm).toBeGreaterThan(2_000)
    expect(solution.site.areaSqm).toBeLessThan(4_000)
    const widest = Math.max(...MUMBAI_EXAMPLE_PLOT.roads.map((road) => road.widthM))
    expect(widest).toBeGreaterThanOrEqual(12)
    expect(widest).toBeLessThan(18)
    expect(MUMBAI_EXAMPLE_PLOT.buildingType).toBe('condo')
    expect(offered('mum').premium).toBeGreaterThan(0)
    expect(offered('mum').transferableRights).toBeGreaterThan(0)
    expect(designs.length).toBeGreaterThanOrEqual(2)
  })

  it('pre-fills the Mumbai example’s ASR land rate, per m² of land, from the Ready Reckoner it cites', () => {
    expect(REGIONS.mum.example.landRate).toBe(MUMBAI_EXAMPLE_LAND_RATE)
    expect(MUMBAI_EXAMPLE_LAND_RATE.value).toBeGreaterThan(0)
    expect(MUMBAI_EXAMPLE_LAND_RATE.source).toContain('easr.igrmaharashtra.gov.in')
    expect(MUMBAI_EXAMPLE_LAND_RATE.source).toContain('matched by position')
  })

  it('gives Dubai a plot whose affection plan allows FAR 3.5 and G+8, with every limit the plan states entered, so nothing is left to check', () => {
    const { solution, designs } = solved('dxb')
    expect(DUBAI_EXAMPLE_PLOT.limits).toMatchObject({ maxFar: 3.5, maxStoreys: 9 })
    for (const field of ['roadSetbackM', 'boundarySetbackM', 'maxCoverageShare'] as const) expect(DUBAI_EXAMPLE_PLOT.limits?.[field]).toBeDefined()
    expect(REGIONS.dxb.example.limitsSource).toContain('cgidubai.gov.in')
    expect(solution.farCap.maxGfaSqm).toBeCloseTo(3.5 * solution.site.areaSqm, 6)
    expect(designs.length).toBeGreaterThanOrEqual(2)
    for (const design of designs) {
      expect(design.metrics.storeys).toBeLessThanOrEqual(9)
      expect(design.checks.filter((check) => check.status !== 'pass')).toEqual([])
    }
  })

  it('applies an example’s sourced inputs only on the example’s own site', () => {
    const { mum, dxb, custom } = REGIONS
    expect(isExampleSite(mum, MUMBAI_EXAMPLE_PLOT.ring)).toBe(true)
    expect(isExampleSite(dxb, MUMBAI_EXAMPLE_PLOT.ring)).toBe(false)
    expect(isExampleSite(custom, MUMBAI_EXAMPLE_PLOT.ring)).toBe(false)
    const [first, ...rest] = MUMBAI_EXAMPLE_PLOT.ring
    expect(isExampleSite(mum, [[first[0] + 1e-6, first[1]], ...rest])).toBe(false)
    expect(isExampleSite(mum, rest)).toBe(false)
  })
})
