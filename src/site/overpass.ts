import { HIGHWAY_CLASSES } from './assumptions'
import type { Bbox } from './bbox'
import { OverpassResponseSchema, type OverpassResponse } from './overpass-response'

export const OVERPASS_INSTANCES = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]

const USER_AGENT = 'plotwise/0.1'
const SERVER_TIMEOUT_S = 12
const CLIENT_TIMEOUT_MS = 15_000

export class OverpassUnavailableError extends Error {
  constructor(readonly attempts: string[]) {
    super(`Overpass is unavailable: ${attempts.join('; ')}`)
  }
}

export function overpassQuery([minLng, minLat, maxLng, maxLat]: Bbox, timeoutS = SERVER_TIMEOUT_S): string {
  const area = `(${minLat},${minLng},${maxLat},${maxLng})`
  return [
    `[out:json][timeout:${timeoutS}];(`,
    `way["building"]["building"!="no"]${area};`,
    `relation["building"]["type"="multipolygon"]${area};`,
    `way["building:part"]${area};`,
    `relation["building:part"]["type"="multipolygon"]${area};`,
    `way["highway"~"^(${HIGHWAY_CLASSES.join('|')})$"]${area};`,
    `);out geom;`,
  ].join('')
}

export type FetchOverpassOptions = {
  instances?: readonly string[]
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

async function queryInstance(
  instance: string,
  query: string,
  timeoutMs: number,
  fetchImpl: typeof fetch,
): Promise<OverpassResponse> {
  const response = await fetchImpl(instance, {
    method: 'POST',
    headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const body = OverpassResponseSchema.safeParse(await response.json())
  if (!body.success) throw new Error('unexpected response shape')
  if (body.data.remark?.includes('runtime error')) throw new Error(body.data.remark)
  return body.data
}

function describeFailure(instance: string, error: unknown): string {
  return `${instance}: ${error instanceof Error ? error.message : String(error)}`
}

export async function fetchOverpass(
  bbox: Bbox,
  { instances = OVERPASS_INSTANCES, timeoutMs = CLIENT_TIMEOUT_MS, fetchImpl = fetch }: FetchOverpassOptions = {},
): Promise<OverpassResponse> {
  const query = overpassQuery(bbox)
  const attempts: string[] = []
  for (const instance of instances) {
    try {
      return await queryInstance(instance, query, timeoutMs, fetchImpl)
    } catch (error) {
      attempts.push(describeFailure(instance, error))
    }
  }
  throw new OverpassUnavailableError(attempts)
}
