import { describe, expect, it } from 'bun:test'
import { BUILDING_TYPES } from '@/plot/plot'
import { MONEY_REGIONS } from '@/solve'
import { PARAMETERS, storageKey } from './parameters'
import { loadPack } from '@/rules'
import { enteredValues, missingParameters, packDefaults } from './values'

const everyValue = (use: (typeof BUILDING_TYPES)[number]) => Object.fromEntries(PARAMETERS.map((parameter) => [storageKey(parameter, use), 0.5]))

describe('money values where the region has no sourced prices', () => {
  it('has no default prices for Dubai or custom rules', () => {
    expect(MONEY_REGIONS.dxb.prices).toBeNull()
    expect(MONEY_REGIONS.custom.prices).toBeNull()
  })

  it('needs every value entered before it gives any, and names what is missing', () => {
    expect(enteredValues({}, 'condo')).toBeNull()
    expect(missingParameters({}, 'condo')).toEqual(PARAMETERS)
    const withoutPrice = { ...everyValue('condo'), 'salePrice.condo': undefined }
    expect(enteredValues(withoutPrice, 'condo')).toBeNull()
    expect(missingParameters(withoutPrice, 'condo').map((parameter) => parameter.id)).toEqual(['salePrice'])
  })

  it('reads the entered values for the building type of the plot', () => {
    for (const use of BUILDING_TYPES) {
      const values = enteredValues({ ...everyValue(use), [`salePrice.${use}`]: 90_000 }, use)
      expect(values?.salePrice).toBe(90_000)
      expect(values?.margin).toBe(0.5)
    }
    expect(enteredValues(everyValue('office'), 'condo')).toBeNull()
  })
})

describe('defaults a rule pack gives for values otherwise entered', () => {
  const mumbai = packDefaults(loadPack('mum-suburbs-res'))

  it('takes carpet area as built-up area over the DCPR 2034 ratio, cited, with the stamp-duty convention only explained', () => {
    expect(mumbai.saleableShare?.value).toBeCloseTo(1 / 1.2, 12)
    expect(mumbai.saleableShare?.source).toContain('Reg 15 Note 3')
    expect(mumbai.saleableShare?.source).toContain('Reg 17(1) Note (g)')
    expect(mumbai.saleableShare?.source).toContain('Ready Reckoner')
    expect(packDefaults(loadPack('bkk-y9'))).toEqual({})
  })

  it('counts a defaulted value as given, and lets an entered value win over it', () => {
    expect(missingParameters({}, 'condo', mumbai).map((parameter) => parameter.id)).not.toContain('saleableShare')
    const rest = { ...everyValue('condo'), 'saleableShare.condo': undefined }
    expect(enteredValues(rest, 'condo', mumbai)?.saleableShare).toBeCloseTo(1 / 1.2, 12)
    expect(enteredValues({ ...rest, 'saleableShare.condo': 0.7 }, 'condo', mumbai)?.saleableShare).toBe(0.7)
  })
})
