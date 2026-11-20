import { entered, enteredCite, type Range } from './cite'
import { loadPack } from './load'
import { RulePackSchema, type RulePack } from './pack'

export const BANGKOK = loadPack('bkk-y9')

const FIELD = 'test'

export function band(min?: number, max?: number): Range {
  return {
    ...(min === undefined ? {} : { min: { value: min, cmp: 'gte', cite: enteredCite(FIELD) } }),
    ...(max === undefined ? {} : { max: { value: max, cmp: 'lt', cite: enteredCite(FIELD) } }),
  }
}

export const value = (number: number) => entered(number, FIELD)

export const unverified = (overrides: Partial<RulePack>): RulePack =>
  RulePackSchema.parse({ ...BANGKOK, verification: 'unverified', ...overrides })

export const PER_PLOT: RulePack = RulePackSchema.parse({
  id: 'per-plot',
  verification: 'unverified',
  sources: {},
  far: { kind: 'plotSpecific', notes: [] },
  height: { planLimit: { kind: 'plotSpecific' } },
  coverage: { kind: 'plotSpecific', required: true },
  plotSetbacks: { kind: 'plotSpecific', edges: 'roadAndBoundary', notes: [] },
  openSpaceMinimums: [],
  roadSetbacks: [],
  boundarySetbacks: [],
  parking: [],
  questions: [],
  gaps: [],
})
