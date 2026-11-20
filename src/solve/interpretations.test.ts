import { describe, expect, it } from 'bun:test'
import { loadPack } from '@/rules'
import { InterpretationsSchema, isMember, packInterpretations, readingSources, type Interpretations } from './interpretations'

const pack = loadPack('bkk-y9')

describe('interpretations', () => {
  it('asks exactly the questions the pack asks, with exactly its readings', () => {
    const engine = Object.entries(InterpretationsSchema.shape).map(([id, readings]) => [id, [...readings.options].sort()])
    const fromPack = pack.questions.map((q) => [q.id, q.readings.map((r) => r.id).sort()])
    expect(Object.fromEntries(engine)).toEqual(Object.fromEntries(fromPack))
  })

  it('takes each decision from the pack', () => {
    const expected = Object.fromEntries(pack.questions.map((q) => [q.id, q.decision]))
    expect(packInterpretations(pack) as Record<string, string | null>).toEqual(expected)
  })

  it('refuses a pack with an undecided question instead of picking a reading', () => {
    const undecided = { ...pack, questions: pack.questions.map((q, i) => (i === 0 ? { ...q, decision: null } : q)) }
    expect(() => packInterpretations(undecided)).toThrow(pack.questions[0].id)
  })

  it('rejects an incomplete record or an unknown reading at the boundary', () => {
    const missing: Partial<Interpretations> = { ...packInterpretations(pack) }
    delete missing['parking-source']
    expect(InterpretationsSchema.safeParse(missing).success).toBe(false)
    expect(InterpretationsSchema.safeParse({ ...packInterpretations(pack), 'parking-source': 'maybe' }).success).toBe(false)
  })

  it('names the sources a reading relies on', () => {
    expect(readingSources(pack, 'parking-source', 'bylaw')).toEqual(new Set(['bb44-03']))
    expect(readingSources(pack, 'parking-source', 'higher-of-both')).toEqual(new Set(['bb44-03', 'mr17-07-upd64']))
  })

  it('resolves a stated class from its cite and a contested class from the chosen reading', () => {
    const readings = packInterpretations(pack)
    expect(isMember(pack, pack.classification!.condo.residential, readings)).toMatchObject({ member: true })
    const hotel = pack.classification!.hotel.residential
    expect(isMember(pack, hotel, { ...readings, 'hotel-residential': 'residential' }).member).toBe(true)
    const asPublic = isMember(pack, hotel, { ...readings, 'hotel-residential': 'public-building' })
    expect(asPublic.member).toBe(false)
    expect(asPublic.cites.length).toBeGreaterThan(0)
  })
})
