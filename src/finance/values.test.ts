import { describe, expect, it } from 'bun:test'
import fc from 'fast-check'
import { BUILDING_TYPES, type BuildingType } from '@/plot/plot'
import { REGIONS } from '@/region/regions'
import { loadPack, type RulePack } from '@/rules'
import { BANGKOK } from '@/rules/test-packs'
import { MONEY_REGIONS, type AreaTier, type ExampleMoney, type MoneyRegion } from '@/solve'
import { PARAMETERS, parametersFor, ratesFor, SCALARS, storageKey, type Parameter, type ParameterId } from './parameters'
import { BASEMENT_RATES, defaultOf, missingParameters, moneyDefaults, packDefaults, resolveValues, type Overrides } from './values'

const CUSTOM = loadPack('custom')
const MUMBAI = loadPack('mum-suburbs-res')
const DUBAI = loadPack('dxb-ap')
const CLASSED = { ...CUSTOM, buildingClasses: BANGKOK.buildingClasses, highRise: BANGKOK.highRise }
const HIGH_RISE: readonly string[] = ['substructure.highRise.low', 'substructure.highRise.high', 'superstructure.highRise.low', 'superstructure.highRise.high']

const ids = (parameters: readonly { id: string }[]) => parameters.map((parameter) => parameter.id)
const localOf = (parameters: readonly Parameter[]) => parameters.filter((parameter) => parameter.block === 'local')
const genericOf = (parameters: readonly Parameter[]) => parameters.filter((parameter) => parameter.block === 'generic')

const everyValue = (use: BuildingType) => Object.fromEntries(PARAMETERS.map((parameter) => [storageKey(parameter, use), 0.5]))

const defaultsFor = (region: MoneyRegion, pack: RulePack, use: BuildingType = 'condo', example: ExampleMoney | null = null) =>
  moneyDefaults(region, { pack, use, tier: region.local ? 'cityFringe' : null }, example)

const enteredValues = (overrides: Overrides, use: BuildingType, pack: RulePack, region: MoneyRegion = MONEY_REGIONS.custom) =>
  resolveValues(overrides, defaultsFor(region, pack, use))

const missingIds = (overrides: Overrides, region: MoneyRegion, pack: RulePack) => ids(missingParameters(overrides, defaultsFor(region, pack)))

describe('money values where the region has no sourced local prices', () => {
  it('has no local prices for Mumbai, Dubai or custom rules, only the generic defaults Bangkok carries', () => {
    for (const id of ['mum', 'dxb', 'custom'] as const) {
      expect(MONEY_REGIONS[id].local).toBeNull()
      expect(MONEY_REGIONS[id].generic.developerMargin.value).toBe(MONEY_REGIONS.bkk.generic.developerMargin.value)
    }
  })

  it('asks only for the local values: sale price, build rates and nearby land prices', () => {
    expect(missingIds({}, MONEY_REGIONS.custom, CLASSED)).toEqual(ids(localOf(PARAMETERS)))
    expect(enteredValues({}, 'condo', CLASSED)).toBeNull()
    const withoutPrice = { ...everyValue('condo'), 'salePrice.condo': undefined }
    expect(enteredValues(withoutPrice, 'condo', CLASSED)).toBeNull()
    expect(missingIds(withoutPrice, MONEY_REGIONS.custom, CLASSED)).toEqual(['salePrice'])
  })

  it('labels every generic default generic, not local, with the value and source it reuses from Bangkok', () => {
    const custom = defaultsFor(MONEY_REGIONS.custom, CLASSED)
    const bangkok = defaultsFor(MONEY_REGIONS.bkk, BANGKOK)
    for (const parameter of genericOf(PARAMETERS)) {
      const generic = defaultOf(parameter, custom)
      const own = defaultOf(parameter, bangkok)
      expect(generic?.kind).toBe('generic')
      expect(own?.kind).toBe('local')
      expect(generic?.value).toBe(own?.value ?? Number.NaN)
      expect(generic?.source).toStartWith('Generic default, not local')
      expect(generic?.source).toEndWith(own?.source ?? Number.NaN.toString())
    }
  })

  it('reads the entered values for the building type of the plot, over the generic defaults', () => {
    for (const use of BUILDING_TYPES) {
      const values = enteredValues({ ...everyValue(use), [`salePrice.${use}`]: 90_000 }, use, CLASSED)
      expect(values?.salePrice).toBe(90_000)
      expect(values?.margin).toBe(0.5)
    }
    const localOnly = Object.fromEntries(localOf(PARAMETERS).map((parameter) => [storageKey(parameter, 'condo'), 7]))
    expect(enteredValues(localOnly, 'condo', CLASSED)?.margin).toBe(MONEY_REGIONS.custom.generic.developerMargin.value)
    expect(enteredValues(everyValue('office'), 'condo', CLASSED)).toBeNull()
  })
})

describe('example money values', () => {
  const EXAMPLES = [
    [MONEY_REGIONS.mum, MUMBAI, REGIONS.mum.example.money],
    [MONEY_REGIONS.dxb, DUBAI, REGIONS.dxb.example.money],
  ] as const

  it('fill every local value of an apartment plot in Mumbai and Dubai but the basement rate, each naming a source fetched on a stated date', () => {
    for (const [region, pack, example] of EXAMPLES) {
      const defaults = defaultsFor(region, pack, 'condo', example)
      expect(ids(missingParameters({}, defaults))).toEqual(['basement.low', 'basement.high'])
      expect(missingParameters({}, defaults, BASEMENT_RATES)).toEqual([])
      for (const parameter of localOf(parametersFor(pack)).filter((p) => !BASEMENT_RATES.has(p))) {
        const filled = defaultOf(parameter, defaults)
        expect(['example', 'split']).toContain(filled?.kind ?? '')
        expect(filled?.value).toBeGreaterThan(0)
        expect(filled?.source).toContain('fetched 2026-11-21')
      }
    }
  })

  it('mark the build rates split from a sourced total as a split, and the quoted figures as example values', () => {
    const defaults = defaultsFor(MONEY_REGIONS.mum, MUMBAI, 'condo', REGIONS.mum.example.money)
    for (const { low, high } of ratesFor(MUMBAI).filter(({ row }) => row !== 'basement')) {
      expect([defaultOf(low, defaults)?.kind, defaultOf(high, defaults)?.kind]).toEqual(['split', 'split'])
    }
    for (const id of ['salePrice', 'landReferenceLow', 'landReferenceHigh'] as const) expect(defaultOf(SCALARS[id], defaults)?.kind).toBe('example')
  })

  it('price without a basement rate only while no design has a basement, as a rate nothing is built at', () => {
    const values = resolveValues({}, defaultsFor(MONEY_REGIONS.mum, MUMBAI, 'condo', REGIONS.mum.example.money), BASEMENT_RATES)
    expect([values?.['basement.low'], values?.['basement.high']]).toEqual([0, 0])
    expect(resolveValues({}, defaultsFor(MONEY_REGIONS.mum, MUMBAI, 'condo', REGIONS.mum.example.money))).toBeNull()
    expect(resolveValues({ 'basement.low': 9, 'basement.high': 11 }, defaultsFor(MONEY_REGIONS.mum, MUMBAI, 'condo', REGIONS.mum.example.money), BASEMENT_RATES)).toMatchObject({ 'basement.low': 9, 'basement.high': 11 })
  })

  it('keep each build rate band low to high and say its split into rows is generic, not local', () => {
    for (const [, , { rates }] of EXAMPLES) {
      for (const range of [rates.substructure, rates.superstructure, rates.services.condo]) {
        expect(range?.low).toBeLessThanOrEqual(range?.high ?? Number.NaN)
        expect(range?.source).toContain('Tall buildings construction guide 2026')
        expect(range?.source).toContain('that split is a generic default, not local')
      }
    }
  })

  it('split the published shell and core cost so the three building rows add up to it', () => {
    const total = ({ rates }: ExampleMoney, bound: 'low' | 'high') =>
      rates.substructure[bound] + rates.superstructure[bound] + (rates.services.condo?.[bound] ?? Number.NaN)
    expect([total(REGIONS.mum.example.money, 'low'), total(REGIONS.mum.example.money, 'high')]).toEqual([48_000, 54_000].map((v) => expect.closeTo(v, 6)))
    expect([total(REGIONS.dxb.example.money, 'low'), total(REGIONS.dxb.example.money, 'high')]).toEqual([5_000, 6_450].map((v) => expect.closeTo(v, 6)))
  })

  it('give Mumbai the ASR land rate and a TDR price, and Dubai neither', () => {
    const { mum, dxb } = REGIONS
    expect(mum.example.money.landRate?.source).toContain('easr.igrmaharashtra.gov.in')
    expect(mum.example.money.tdrPrice?.source).toContain('naredco.in')
    expect([dxb.example.money.landRate, dxb.example.money.tdrPrice]).toEqual([null, null])
  })

  it('give way to any value typed over them', () => {
    const typedOver = localOf(parametersFor(MUMBAI))
    fc.assert(
      fc.property(fc.constantFrom(...typedOver), fc.integer({ min: 1, max: 1_000_000 }), (parameter, typed) => {
        const values = resolveValues({ [storageKey(parameter, 'condo')]: typed }, defaultsFor(MONEY_REGIONS.mum, MUMBAI, 'condo', REGIONS.mum.example.money), BASEMENT_RATES)
        expect(values?.[parameter.id]).toBe(typed)
      }),
    )
  })

  it('leave nothing filled for a building type they have no sale price for', () => {
    const office = defaultsFor(MONEY_REGIONS.mum, MUMBAI, 'office', REGIONS.mum.example.money)
    expect(ids(missingParameters({}, office, BASEMENT_RATES))).toEqual(['salePrice', 'services.low', 'services.high'])
  })
})

describe('build rates where the rules have no building classes', () => {
  it('asks for one set of substructure and superstructure rates, not the high-rise rates no design is costed at', () => {
    for (const pack of [CUSTOM, MUMBAI, DUBAI]) {
      expect(pack.buildingClasses).toBeUndefined()
      expect(ids(parametersFor(pack))).toEqual(ids(PARAMETERS).filter((id) => !HIGH_RISE.includes(id)))
      expect(ratesFor(pack).map(({ row }) => row)).toEqual(['substructure.lowRise', 'superstructure.lowRise', 'services', 'basement'])
      expect(missingIds({}, MONEY_REGIONS.custom, pack)).not.toContain('substructure.highRise.low')
    }
  })

  it('keeps asking Bangkok for low-rise and high-rise rates', () => {
    expect(parametersFor(BANGKOK)).toEqual(PARAMETERS)
    expect(ratesFor(BANGKOK).map(({ row }) => row)).toContain('superstructure.highRise')
  })

  it('prices without the high-rise rates, reading the one set entered for every building', () => {
    const entered = Object.fromEntries(Object.entries(everyValue('condo')).filter(([key]) => !HIGH_RISE.includes(key)))
    const values = enteredValues({ ...entered, 'substructure.lowRise.low': 7, 'superstructure.lowRise.high': 9 }, 'condo', CUSTOM)
    expect(values).toMatchObject({ 'substructure.highRise.low': 7, 'superstructure.highRise.high': 9 })
    expect(enteredValues(entered, 'condo', CLASSED)).toBeNull()
  })
})

describe('defaults a rule pack gives for values otherwise entered', () => {
  const mumbai = packDefaults(MUMBAI)

  it('takes carpet area as built-up area over the DCPR 2034 ratio, cited, with the stamp-duty convention only explained', () => {
    expect(mumbai.saleableShare?.value).toBeCloseTo(1 / 1.2, 12)
    expect(mumbai.saleableShare?.source).toContain('Reg 15 Note 3')
    expect(mumbai.saleableShare?.source).toContain('Reg 17(1) Note (g)')
    expect(mumbai.saleableShare?.source).toContain('Ready Reckoner')
    expect(packDefaults(loadPack('bkk-y9'))).toEqual({})
  })

  it('takes the rule over the generic default, and lets an entered value win over it', () => {
    expect(defaultOf(SCALARS.saleableShare, defaultsFor(MONEY_REGIONS.mum, MUMBAI))?.kind).toBe('rule')
    const rest = { ...everyValue('condo'), 'saleableShare.condo': undefined }
    expect(enteredValues(rest, 'condo', MUMBAI, MONEY_REGIONS.mum)?.saleableShare).toBeCloseTo(1 / 1.2, 12)
    expect(enteredValues({ ...rest, 'saleableShare.condo': 0.7 }, 'condo', MUMBAI, MONEY_REGIONS.mum)?.saleableShare).toBe(0.7)
  })
})

describe('sources of the Bangkok money defaults', () => {
  type Basis = { readonly use: BuildingType; readonly tier: AreaTier }
  const byId = new Map(PARAMETERS.map((parameter) => [parameter.id, parameter]))
  const sourceOf = (id: ParameterId, { use, tier }: Basis) => {
    const parameter = byId.get(id)
    return parameter && defaultOf(parameter, moneyDefaults(MONEY_REGIONS.bkk, { pack: BANGKOK, use, tier }, null))?.source
  }
  const office: Basis = { use: 'office', tier: 'cityFringe' }
  const condo: Basis = { use: 'condo', tier: 'cityFringe' }

  it('takes the office services rate and the basement rate from the dated BOI construction cost table', () => {
    for (const id of ['services.low', 'services.high', 'basement.low', 'basement.high'] as const) {
      expect(sourceOf(id, office)).toContain('https://www.boi.go.th/en/typical_costs_of_starting_and_operating_a_business')
      expect(sourceOf(id, office)).toContain('Last Update: March 27th, 2026')
      expect(sourceOf(id, office)).toContain('the same baht figures as the 2020 edition')
    }
    expect(sourceOf('services.low', office)).toContain('which are unsourced Plotwise estimates')
  })

  it('labels the split and the uses BOI gives no row for as unsourced, checked against the published totals', () => {
    for (const id of ['substructure.lowRise.low', 'superstructure.highRise.high', 'services.low'] as const) {
      expect(sourceOf(id, condo)).toContain('unsourced')
      expect(sourceOf(id, condo)).toContain('RHLB (Siam) Ltd., Construction Commentary, issue July 2025')
    }
    expect(sourceOf('services.low', condo)).toContain('no condominium row')
    expect(sourceOf('services.low', { use: 'hotel', tier: 'cbd' })).toContain('no hotel row')
  })

  it('prices a CBD condo from CBRE Q3 2026 and the other areas from Knight Frank, with CBRE named for comparison', () => {
    expect(sourceOf('salePrice', { use: 'condo', tier: 'cbd' })).toContain('CBRE Thailand, Bangkok Overall Figures Q3 2026')
    for (const tier of ['cityFringe', 'suburban'] as const) {
      expect(sourceOf('salePrice', { use: 'condo', tier })).toContain('Knight Frank Thailand, Bangkok Condominium Market Overview Q1 2026')
      expect(sourceOf('salePrice', { use: 'condo', tier })).toContain('CBRE Thailand, Bangkok Overall Figures Q3 2026')
    }
  })

  it('gives the Treasury appraised value as an official reference, not a market price, for CBD land', () => {
    const source = sourceOf('landReferenceHigh', { use: 'condo', tier: 'cbd' })
    expect(source).toContain('Official reference, not a market price')
    expect(source).toContain('https://assessprice.treasury.go.th')
  })
})
