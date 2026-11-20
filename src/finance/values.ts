import type { BuildingType } from '@/plot/plot'
import { isSourceCite, type Cite, type RulePack } from '@/rules'
import { CARPET_RATIO_NOTE, type MoneyPrices } from '@/solve'
import { enteredAs, PARAMETERS, parametersFor, storageKey, type Assumed, type Basis, type Parameter, type ParameterId } from './parameters'

export type Overrides = Readonly<Partial<Record<string, number>>>
export type Values = Readonly<Record<ParameterId, number>>

export function resolveValues(prices: MoneyPrices, basis: Basis, overrides: Overrides): Values {
  const entries = PARAMETERS.map((parameter) => [parameter.id, overrides[storageKey(parameter, basis.use)] ?? parameter.assumed(prices, basis).value])
  return Object.fromEntries(entries) as Values
}

export type Defaults = Readonly<Partial<Record<ParameterId, Assumed>>>

const NO_DEFAULTS: Defaults = {}

const citeText = (cite: Cite) => (isSourceCite(cite) ? `${cite.clause}, page ${cite.page} line ${cite.line}: "${cite.quote}"` : cite.field)

export function packDefaults({ carpetArea, sources }: RulePack): Defaults {
  if (!carpetArea) return NO_DEFAULTS
  const [ratio] = carpetArea.builtUpPerCarpet
  const cites = [...carpetArea.builtUpPerCarpet.map((r) => r.cite), carpetArea.definition]
  const source = Object.values(sources)[0]?.name
  return {
    saleableShare: {
      value: 1 / ratio.value,
      source: `carpet area = built-up area ÷ ${ratio.value}, from ${source}: ${cites.map(citeText).join('; ')}. ${CARPET_RATIO_NOTE}`,
    },
  }
}

const valueOf = (parameter: Parameter, overrides: Overrides, use: BuildingType, defaults: Defaults) =>
  overrides[storageKey(parameter, use)] ?? defaults[parameter.id]?.value

export function missingParameters(overrides: Overrides, use: BuildingType, pack: RulePack): readonly Parameter[] {
  const defaults = packDefaults(pack)
  return parametersFor(pack).filter((parameter) => valueOf(parameter, overrides, use, defaults) === undefined)
}

export function enteredValues(overrides: Overrides, use: BuildingType, pack: RulePack): Values | null {
  if (missingParameters(overrides, use, pack).length > 0) return null
  const defaults = packDefaults(pack)
  return Object.fromEntries(PARAMETERS.map((parameter) => [parameter.id, valueOf(enteredAs(parameter, pack), overrides, use, defaults)])) as Values
}
