import { describe, expect, it } from 'bun:test'
import { loadPack } from '@/rules'
import { bboxContains } from '@/site/bbox'
import { MONEY_REGIONS, plotLimitFields } from '@/solve'
import { ZONE_SOURCES } from '@/zone/sources'
import { DEFAULT_REGION, REGION_IDS, RegionIdSchema, REGIONS } from './regions'

describe('regions', () => {
  it('offers Bangkok, Dubai, Mumbai and custom rules, with Bangkok for links that name none', () => {
    expect(REGION_IDS).toEqual(['bkk', 'dxb', 'mum', 'custom'])
    expect(DEFAULT_REGION.id).toBe('bkk')
  })

  it('accepts only known region ids at the boundary', () => {
    for (const id of REGION_IDS) expect(RegionIdSchema.parse(id)).toBe(id)
    for (const bad of ['', 'BKK', 'dubai', 'mumbai', 'MUM', '__proto__']) expect(RegionIdSchema.safeParse(bad).success).toBe(false)
  })

  it('keeps verified rules for Bangkok only; Dubai and custom rules take every limit from the user', () => {
    expect(loadPack(REGIONS.bkk.packId).verification).toBe('verified')
    expect(plotLimitFields(loadPack(REGIONS.bkk.packId))).toEqual([])
    for (const region of [REGIONS.dxb, REGIONS.custom]) {
      expect(loadPack(region.packId).verification).toBe('unverified')
      expect(plotLimitFields(loadPack(region.packId))).toContain('maxGfaSqm')
    }
  })

  it('holds the zone gate to regions with a zone source, which is Bangkok alone', () => {
    for (const id of REGION_IDS) expect(REGIONS[id].zone !== null).toBe(id in ZONE_SOURCES)
    expect(REGION_IDS.filter((id) => REGIONS[id].zone)).toEqual(['bkk'])
  })

  it('opens the map inside the region, and on the whole world for custom rules', () => {
    for (const id of REGION_IDS) {
      const { mapStart, bounds, searchBias } = REGIONS[id]
      if (!bounds) continue
      expect(bboxContains(bounds.value, mapStart.value.centre)).toBe(true)
      expect(searchBias && bboxContains(bounds.value, searchBias.value)).toBe(true)
    }
    expect(REGIONS.custom.bounds).toBeNull()
    expect(REGIONS.custom.mapStart.value.zoom).toBeLessThan(REGIONS.bkk.mapStart.value.zoom)
  })

  it('shows Dubai in m² and AED, Bangkok in m² and baht, custom rules in m² with no currency', () => {
    expect([REGIONS.bkk.areaUnit, MONEY_REGIONS.bkk.currency]).toEqual(['sqm', 'THB'])
    expect([REGIONS.dxb.areaUnit, MONEY_REGIONS.dxb.landUnit.name, MONEY_REGIONS.dxb.currency]).toEqual(['sqm', 'm²', 'AED'])
    expect([REGIONS.custom.areaUnit, MONEY_REGIONS.custom.currency]).toEqual(['sqm', null])
  })

  it('reads Mumbai from the DCPR 2034 draft: unverified, nothing entered for the plot, FSI, INR, sq ft and carpet area', () => {
    const { mum } = REGIONS
    const pack = loadPack(mum.packId)
    expect([mum.rules, pack.verification]).toEqual(['draftPack', 'unverified'])
    expect(plotLimitFields(pack)).toEqual([])
    expect(mum.limitTerms).toBeNull()
    expect(mum.areaTerms).toMatchObject({ ratio: 'FSI', saleable: 'carpet area' })
    expect([mum.areaUnit, MONEY_REGIONS.mum.currency, MONEY_REGIONS.mum.local]).toEqual(['sqft', 'INR', null])
    expect(mum.cityPlan.version).toBe('DCPR 2034 as sanctioned in 2018')
  })
})
