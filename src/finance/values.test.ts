import { describe, expect, it } from 'bun:test'
import { BUILDING_TYPES } from '@/plot/plot'
import { MONEY_REGIONS } from '@/solve'
import { PARAMETERS, storageKey } from './parameters'
import { enteredValues, missingParameters } from './values'

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
