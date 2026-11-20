import { isPlotLimitField, PlotLimitsSchema, PlotSchema, type Plot, type PlotLimits } from '@/plot/plot'
import { DEFAULT_REGION, RegionIdSchema, REGIONS, type RegionExample } from '@/region/regions'
import type { RegionId } from '@/solve'

const LIST = ';'
const PAIR = ','
const ROAD = ':'
const LIMIT = ':'
const STATION = '1'
const RULES = 'rules'

function strictNumber(text: string) {
  return text.trim() === '' ? Number.NaN : Number(text)
}

function numbers(text: string, separator: string) {
  return text.split(separator).map(strictNumber)
}

const paramsOf = (fragment: string) => new URLSearchParams(fragment.replace(/^#/, ''))

function encodeLimits(limits: PlotLimits | undefined): string {
  const pairs = Object.entries(limits ?? {}).map(([field, value]) => `${field}${LIMIT}${value}`)
  return pairs.length === 0 ? '' : `&limits=${pairs.join(LIST)}`
}

export function encodePlot(plot: Plot) {
  const ring = plot.ring.map((p) => p.join(PAIR)).join(LIST)
  const roads = plot.roads.map((r) => [r.edge, r.widthM, ...(r.prescribedWidthM === undefined ? [] : [r.prescribedWidthM])].join(ROAD)).join(LIST)
  const station = plot.nearStation ? `&station=${STATION}` : ''
  return `plot=${ring}&roads=${roads}&type=${plot.buildingType}${station}${encodeLimits(plot.limits)}`
}

export const EXAMPLE_FRAGMENT = 'example'

export type LinkProblem = 'link-incomplete' | 'link-invalid' | 'link-limits'
export type DecodedLink = { ok: true; plot: Plot } | { ok: false; problem: LinkProblem }

const rejected = (problem: LinkProblem) => ({ ok: false, problem }) as const

function decodeLimits(given: readonly string[]): Record<string, number> | null | undefined {
  if (given.length === 0) return undefined
  if (given.length > 1) return null
  const [text] = given
  const pairs = text.split(LIST).map((pair) => pair.split(LIMIT))
  const fields = pairs.map(([field]) => field)
  if (pairs.some((pair) => pair.length !== 2 || !isPlotLimitField(pair[0])) || new Set(fields).size !== fields.length) return null
  const entries = pairs.map(([field, value]) => [field, strictNumber(value)] as const)
  return entries.some(([, value]) => Number.isNaN(value)) ? null : Object.fromEntries(entries)
}

export function decodePlot(fragment: string): DecodedLink | null {
  const params = paramsOf(fragment)
  const ring = params.get('plot')
  const roads = params.get('roads')
  const buildingType = params.get('type')
  const station = params.get('station')
  if (ring === null && roads === null && buildingType === null) return null
  if (ring === null || roads === null || buildingType === null) return rejected('link-incomplete')
  if (station !== null && station !== STATION) return rejected('link-invalid')
  const limits = decodeLimits(params.getAll('limits'))
  if (limits === null) return rejected('link-invalid')
  if (limits && !PlotLimitsSchema.safeParse(limits).success) return rejected('link-limits')
  const parsed = PlotSchema.safeParse({
    ring: ring.split(LIST).map((p) => numbers(p, PAIR)),
    roads: roads.split(LIST).map((r) => {
      const [edge, widthM, ...rest] = numbers(r, ROAD)
      return rest.length === 0 ? { edge, widthM } : { edge, widthM, prescribedWidthM: rest.length === 1 ? rest[0] : Number.NaN }
    }),
    buildingType,
    nearStation: station === STATION,
    ...(limits && { limits }),
  })
  return parsed.success ? { ok: true, plot: parsed.data } : rejected('link-invalid')
}

export const encodeRegion = (region: RegionId) => (region === DEFAULT_REGION.id ? '' : `${RULES}=${region}`)

export type DecodedRegion = { ok: true; region: RegionId } | { ok: false; problem: LinkProblem }

export function decodeRegion(fragment: string): DecodedRegion {
  const named = paramsOf(fragment).getAll(RULES)
  if (named.length === 0) return { ok: true, region: DEFAULT_REGION.id }
  const parsed = RegionIdSchema.safeParse(named.length === 1 ? named[0] : null)
  return parsed.success ? { ok: true, region: parsed.data } : rejected('link-invalid')
}

export const exampleFragment = (region: RegionId) => [encodeRegion(region), EXAMPLE_FRAGMENT].filter(Boolean).join('&')

export type LinkedExample = { readonly region: RegionId; readonly example: RegionExample }

export function linkedExample(fragment: string): LinkedExample | null {
  if (!paramsOf(fragment).has(EXAMPLE_FRAGMENT)) return null
  const rules = decodeRegion(fragment)
  const { id, example } = rules.ok ? REGIONS[rules.region] : DEFAULT_REGION
  return example ? { region: id, example } : { region: DEFAULT_REGION.id, example: DEFAULT_REGION.example }
}
