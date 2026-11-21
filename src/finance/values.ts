import type { BuildingType } from '@/plot/plot'
import { isSourceCite, type Cite, type RulePack } from '@/rules'
import { CARPET_RATIO_NOTE, type AreaTier, type ExampleMoney, type GenericMoney, type LocalMoney, type MoneyRegion } from '@/solve'
import { enteredAs, PARAMETERS, parametersFor, RATES, storageKey, type Assumed, type Parameter, type ParameterId } from './parameters'

export type Overrides = Readonly<Partial<Record<string, number>>>
export type Values = Readonly<Record<ParameterId, number>>

type RuleDefaults = Readonly<Partial<Record<ParameterId, Assumed>>>

const NO_RULE_DEFAULTS: RuleDefaults = {}

const citeText = (cite: Cite) => (isSourceCite(cite) ? `${cite.clause}, page ${cite.page} line ${cite.line}: "${cite.quote}"` : cite.field)

export function packDefaults({ carpetArea, sources }: RulePack): RuleDefaults {
  if (!carpetArea) return NO_RULE_DEFAULTS
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

export type DefaultKind = 'rule' | 'example' | 'split' | 'local' | 'generic'

export type Default = Assumed & { readonly kind: DefaultKind }

export type MoneyDefaults = {
  readonly pack: RulePack
  readonly use: BuildingType
  readonly rules: RuleDefaults
  readonly generic: { readonly money: GenericMoney; readonly kind: Extract<DefaultKind, 'local' | 'generic'> }
  readonly local: { readonly money: LocalMoney; readonly tier: AreaTier } | null
  readonly example: ExampleMoney | null
}

export type MoneySite = { readonly pack: RulePack; readonly use: BuildingType; readonly tier: AreaTier | null }

export function moneyDefaults(region: MoneyRegion, { pack, use, tier }: MoneySite, example: ExampleMoney | null): MoneyDefaults {
  return {
    pack,
    use,
    rules: packDefaults(pack),
    generic: { money: region.generic, kind: region.local ? 'local' : 'generic' },
    local: region.local && tier ? { money: region.local, tier } : null,
    example,
  }
}

const withKind = (assumed: Assumed | null, kind: DefaultKind): Default | null => assumed && { ...assumed, kind }

function sourcedDefault(parameter: Parameter, { use, generic, local, example }: MoneyDefaults): Default | null {
  if (parameter.block === 'generic') return withKind(parameter.generic(generic.money, use), generic.kind)
  return (example && parameter.example(example, use)) ?? (local && withKind(parameter.local(local.money, { use, tier: local.tier }), 'local'))
}

export function defaultOf(parameter: Parameter, defaults: MoneyDefaults): Default | null {
  const entered = enteredAs(parameter, defaults.pack)
  return withKind(defaults.rules[entered.id] ?? null, 'rule') ?? sourcedDefault(entered, defaults)
}

export type UnusedRates = ReadonlySet<Parameter>

export const NO_UNUSED_RATES: UnusedRates = new Set()

export const BASEMENT_RATES: UnusedRates = new Set(RATES.filter(({ row }) => row === 'basement').flatMap(({ low, high }) => [low, high]))

const UNUSED_RATE = 0

const valueOf = (parameter: Parameter, overrides: Overrides, defaults: MoneyDefaults, unused: UnusedRates) =>
  overrides[storageKey(enteredAs(parameter, defaults.pack), defaults.use)] ?? defaultOf(parameter, defaults)?.value ?? (unused.has(parameter) ? UNUSED_RATE : undefined)

export const enteredOrDefault = (parameter: Parameter, overrides: Overrides, defaults: MoneyDefaults) => valueOf(parameter, overrides, defaults, NO_UNUSED_RATES)

export const missingParameters = (overrides: Overrides, defaults: MoneyDefaults, unused = NO_UNUSED_RATES): readonly Parameter[] =>
  parametersFor(defaults.pack).filter((parameter) => valueOf(parameter, overrides, defaults, unused) === undefined)

export function resolveValues(overrides: Overrides, defaults: MoneyDefaults, unused = NO_UNUSED_RATES): Values | null {
  const entries = PARAMETERS.map((parameter) => [parameter.id, valueOf(parameter, overrides, defaults, unused)] as const)
  return entries.every(([, value]) => value !== undefined) ? (Object.fromEntries(entries) as Values) : null
}

export function sourcedValues(region: MoneyRegion, site: MoneySite, overrides: Overrides = {}): Values {
  const values = resolveValues(overrides, moneyDefaults(region, site, null))
  if (!values) throw new Error('This region has no sourced default for every money value')
  return values
}
