import { describe, expect, it } from 'bun:test'
import { BUILDING_TYPES } from '@/plot/plot'
import { MONEY_REGIONS } from '@/solve'
import { loadPack } from '@/rules'
import { BANGKOK } from '@/rules/test-packs'
import { PARAMETERS, parametersFor, ratesFor, storageKey, type Basis, type ParameterId } from './parameters'
import { enteredValues, missingParameters, packDefaults } from './values'

const CUSTOM = loadPack('custom')
const MUMBAI = loadPack('mum-suburbs-res')
const CLASSED = { ...CUSTOM, buildingClasses: BANGKOK.buildingClasses, highRise: BANGKOK.highRise }

const everyValue = (use: (typeof BUILDING_TYPES)[number]) => Object.fromEntries(PARAMETERS.map((parameter) => [storageKey(parameter, use), 0.5]))

describe('money values where the region has no sourced prices', () => {
  it('has no default prices for Dubai or custom rules', () => {
    expect(MONEY_REGIONS.dxb.prices).toBeNull()
    expect(MONEY_REGIONS.custom.prices).toBeNull()
  })

  it('needs every value entered before it gives any, and names what is missing', () => {
    expect(enteredValues({}, 'condo', CLASSED)).toBeNull()
    expect(missingParameters({}, 'condo', CLASSED)).toEqual(PARAMETERS)
    const withoutPrice = { ...everyValue('condo'), 'salePrice.condo': undefined }
    expect(enteredValues(withoutPrice, 'condo', CLASSED)).toBeNull()
    expect(missingParameters(withoutPrice, 'condo', CLASSED).map((parameter) => parameter.id)).toEqual(['salePrice'])
  })

  it('reads the entered values for the building type of the plot', () => {
    for (const use of BUILDING_TYPES) {
      const values = enteredValues({ ...everyValue(use), [`salePrice.${use}`]: 90_000 }, use, CLASSED)
      expect(values?.salePrice).toBe(90_000)
      expect(values?.margin).toBe(0.5)
    }
    expect(enteredValues(everyValue('office'), 'condo', CLASSED)).toBeNull()
  })
})

describe('build rates where the rules have no building classes', () => {
  const HIGH_RISE = ['substructure.highRise.low', 'substructure.highRise.high', 'superstructure.highRise.low', 'superstructure.highRise.high']
  const ids = (parameters: readonly { id: string }[]) => parameters.map((parameter) => parameter.id)

  it('asks for one set of substructure and superstructure rates, not the high-rise rates no design is costed at', () => {
    for (const pack of [CUSTOM, MUMBAI, loadPack('dxb-ap')]) {
      expect(pack.buildingClasses).toBeUndefined()
      expect(ids(parametersFor(pack))).toEqual(ids(PARAMETERS).filter((id) => !HIGH_RISE.includes(id)))
      expect(ratesFor(pack).map(({ row }) => row)).toEqual(['substructure.lowRise', 'superstructure.lowRise', 'services', 'basement'])
      expect(ids(missingParameters({}, 'condo', pack))).not.toContain('substructure.highRise.low')
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

  it('counts a defaulted value as given, and lets an entered value win over it', () => {
    expect(missingParameters({}, 'condo', MUMBAI).map((parameter) => parameter.id)).not.toContain('saleableShare')
    const rest = { ...everyValue('condo'), 'saleableShare.condo': undefined }
    expect(enteredValues(rest, 'condo', MUMBAI)?.saleableShare).toBeCloseTo(1 / 1.2, 12)
    expect(enteredValues({ ...rest, 'saleableShare.condo': 0.7 }, 'condo', MUMBAI)?.saleableShare).toBe(0.7)
  })
})

describe('sources of the Bangkok money defaults', () => {
  const prices = MONEY_REGIONS.bkk.prices
  const sourceOf = (id: ParameterId, basis: Basis) => PARAMETERS.find((parameter) => parameter.id === id)?.assumed(prices, basis).source
  const office: Basis = { use: 'office', tier: 'cityFringe' }
  const condo: Basis = { use: 'condo', tier: 'cityFringe' }

  it('takes the office services rate and the basement rate from the dated BOI construction cost table', () => {
    for (const id of ['services.low', 'services.high', 'basement.low', 'basement.high'] as const) {
      expect(sourceOf(id, office)).toContain('https://www.boi.go.th/en/typical_costs_of_starting_and_operating_a_business')
      expect(sourceOf(id, office)).toContain('Last Update: March 27th, 2026')
    }
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
