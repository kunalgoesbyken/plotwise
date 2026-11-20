import { describe, expect, it } from 'bun:test'
import { RulePackSchema, type RulePack, type SourceCite } from '../src/rules'
import { zoneFar } from '../src/rules/zone-far'
import { checkPack } from './check-pack'

const shipped = RulePackSchema.parse(await Bun.file(`${import.meta.dir}/../src/rules/packs/bkk-y9.json`).json())

const mutate = (change: (pack: RulePack) => void): RulePack => {
  const pack = structuredClone(shipped)
  change(pack)
  return pack
}

const errorsOf = (pack: RulePack) => checkPack(pack).errors.join('\n')

describe('checkPack', () => {
  it('passes the shipped ย.9 pack', () => {
    expect(checkPack(shipped).errors).toEqual([])
  })

  it('flags an interpretation question nobody has decided', () => {
    expect(errorsOf(mutate((p) => void (p.questions[0].decision = null)))).toContain(`question ${shipped.questions[0].id} awaits a decision`)
  })

  it('flags a value outside its plausible range', () => {
    expect(errorsOf(mutate((p) => void (zoneFar(p).max.value = 70)))).toContain('far.max')
    expect(errorsOf(mutate((p) => void (p.openSpaceRatio!.minShareOfFloorArea.value = 4.5)))).toContain('openSpaceRatio')
  })

  it('flags a purchasable FAR cap or price outside its plausible range', () => {
    const cite = shipped.far.kind === 'zone' ? shipped.far.max.cite : shipped.zone!.cite
    const withPurchase = (cap: unknown, price: unknown) => mutate((p) => void (p.farPurchases = [{ kind: 'premium', cap, price, notes: [] } as never]))
    const banded = { kind: 'extraRatioByRoadWidth', bands: [{ kind: 'ratio', roadWidthM: {}, ratio: { value: 70, cite } }] }
    expect(errorsOf(withPurchase(banded, { kind: 'userSupplied' }))).toContain('farPurchases.0.cap.bands.0')
    const fungible = { kind: 'shareOf', of: 'permissible', share: { value: 0.35, cite } }
    expect(errorsOf(withPurchase(fungible, { kind: 'shareOfLandRate', share: { value: 1.5, cite } }))).toContain('farPurchases.0.price')
    expect(errorsOf(withPurchase(fungible, { kind: 'shareOfLandRate', share: { value: 0.5, cite } }))).not.toContain('farPurchases')
  })

  it('flags a gap between road-width bands', () => {
    expect(errorsOf(mutate((p) => void (p.roadSetbacks[0].bands[1].roadWidthM.min!.value = 12)))).toContain('roadSetbacks.0')
  })

  it('flags an overlap where both bands include the shared edge', () => {
    expect(errorsOf(mutate((p) => void (p.roadSetbacks[1].bands[0].roadWidthM.max!.cmp = 'lte')))).toContain('roadSetbacks.1')
  })

  it('flags height bands that stop short of the high-rise threshold', () => {
    expect(errorsOf(mutate((p) => void (p.boundarySetbacks[0].bands[1].heightM.max!.value = 20)))).toContain('boundarySetbacks.0')
  })

  it('flags setbacks that shrink as buildings get taller', () => {
    expect(errorsOf(mutate((p) => void (p.boundarySetbacks[2].bands[1].distanceM.value = 0.5)))).toContain('boundarySetbacks.2')
  })

  it('flags sources that disagree on the same rule', () => {
    expect(errorsOf(mutate((p) => void (p.height.roadMultiple!.maxMultipleOfDistance[1].value = 3)))).toContain('height.roadMultiple')
  })

  it('flags a bonus larger than the combined cap', () => {
    expect(errorsOf(mutate((p) => void (p.farBonus!.combinedMaxShare.value = 0.1)))).toContain('farBonus')
  })

  it('flags a use condition whose road width has no ข้อ 36 tier', () => {
    expect(errorsOf(mutate((p) => void (p.useConditions!.hotel.kind === 'restrictedAbove' && (p.useConditions!.hotel.unlessRoadWidthM.value = 14))))).toContain(
      'useConditions.hotel',
    )
  })

  it('flags a value read from a garbled source', () => {
    expect(errorsOf(mutate((p) => void ((zoneFar(p).max.cite as SourceCite).source = 'bb69-bma')))).toContain('garbled')
  })

  it('flags a cite to an unlisted source', () => {
    expect(errorsOf(mutate((p) => void ((p.zone!.cite as SourceCite).source = 'nope')))).toContain('nope')
  })

  it('flags a classification that points to a missing question', () => {
    expect(errorsOf(mutate((p) => void (p.questions = p.questions.filter((q) => q.id !== 'hotel-residential'))))).toContain(
      'hotel-residential',
    )
  })
})
