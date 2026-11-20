import { isPlotLimitField, PlotSchema, type Plot, type PlotLimits } from '@/plot/plot'
import { DEFAULT_REGION, RegionIdSchema } from '@/region/regions'
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
  const roads = plot.roads.map((r) => `${r.edge}${ROAD}${r.widthM}`).join(LIST)
  const station = plot.nearStation ? `&station=${STATION}` : ''
  return `plot=${ring}&roads=${roads}&type=${plot.buildingType}${station}${encodeLimits(plot.limits)}`
}

export const EXAMPLE_FRAGMENT = 'example'

export const isExampleLink = (fragment: string) => new URLSearchParams(fragment.replace(/^#/, '')).has(EXAMPLE_FRAGMENT)

export type LinkProblem = 'link-incomplete' | 'link-invalid'
export type DecodedLink = { ok: true; plot: Plot } | { ok: false; problem: LinkProblem }

const rejected = (problem: LinkProblem) => ({ ok: false, problem }) as const

function decodeLimits(text: string | null): Record<string, number> | null | undefined {
  if (text === null) return undefined
  const pairs = text.split(LIST).map((pair) => pair.split(LIMIT))
  const fields = pairs.map(([field]) => field)
  if (pairs.some((pair) => pair.length !== 2 || !isPlotLimitField(pair[0])) || new Set(fields).size !== fields.length) return null
  return Object.fromEntries(pairs.map(([field, value]) => [field, strictNumber(value)]))
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
  const limits = decodeLimits(params.get('limits'))
  if (limits === null) return rejected('link-invalid')
  const parsed = PlotSchema.safeParse({
    ring: ring.split(LIST).map((p) => numbers(p, PAIR)),
    roads: roads.split(LIST).map((r) => {
      const [edge, widthM] = numbers(r, ROAD)
      return { edge, widthM }
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
