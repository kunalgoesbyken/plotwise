import { describe, expect, it } from 'bun:test'
import { loadPack } from '@/rules'
import { demandCites, demandText } from './parking-text'

const [bylaw, ministerial] = loadPack('bkk-y9').parking

describe('demandText', () => {
  it('states each parking rule with the numbers from the pack', () => {
    expect(demandText(bylaw.condo)).toBe('1 per unit of ≥ 60 m².')
    expect(demandText(bylaw.office)).toBe('1 per 60 m² of floor area, for offices of ≥ 300 m².')
    expect(demandText(bylaw.hotel)).toBe('10 for the first 30 rooms, then 1 per 5 rooms up to 100 and 1 per 10 rooms beyond.')
    expect(demandText(ministerial.hotel)).toBe('1 per 10 m² of lobby and 1 per 20 m² of shops.')
  })

  it('cites every number it states', () => {
    expect(demandCites(bylaw.hotel)).toHaveLength(3)
    for (const rule of [bylaw, ministerial])
      for (const demand of [rule.condo, rule.office, rule.hotel])
        expect(demandCites(demand).every((cite) => cite.source === rule.appliesWhere.source)).toBe(true)
  })
})
