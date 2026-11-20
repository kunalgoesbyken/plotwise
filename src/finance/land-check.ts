import type { Range } from './estimate'
import type { Values } from './values'

export type LandCheck = { readonly reference: Range; readonly exceeds: boolean }

export function landCheck(supportedPerUnit: Range, values: Values, warningFactor: number): LandCheck {
  const reference = { low: values.landReferenceLow, high: values.landReferenceHigh }
  return { reference, exceeds: supportedPerUnit.high > reference.high * warningFactor }
}
