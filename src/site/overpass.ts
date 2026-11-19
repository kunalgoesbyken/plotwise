import { HIGHWAY_CLASSES, PLATFORM_MODES, STATION_NODE_TYPES } from './assumptions'
import type { Bbox } from './bbox'
import { OverpassResponseSchema, type OverpassResponse } from './overpass-response'
import { USER_AGENT } from './user-agent'

export const OVERPASS_INSTANCES = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]

const SERVER_TIMEOUT_S = 12
const CLIENT_TIMEOUT_MS = 15_000

export class OverpassUnavailableError extends Error {
  constructor(readonly attempts: string[]) {
    super(`Overpass is unavailable: ${attempts.join('; ')}`)
  }
}

function overpassArea([minLng, minLat, maxLng, maxLat]: Bbox): string {
  return `(${minLat},${minLng},${maxLat},${maxLng})`
}

export function overpassQuery(siteBbox: Bbox, stationBbox: Bbox, timeoutS = SERVER_TIMEOUT_S): string {
  const area = overpassArea(siteBbox)
  const stationArea = overpassArea(stationBbox)
  return [
    `[out:json][timeout:${timeoutS}];(`,
    `way["building"]["building"!="no"]${area};`,
    `relation["building"]["type"="multipolygon"]${area};`,
    `way["building:part"]${area};`,
    `relation["building:part"]["type"="multipolygon"]${area};`,
    `way["highway"~"^(${HIGHWAY_CLASSES.join('|')})$"]${area};`,
    `nw["railway"="platform"]${stationArea};`,
    `nw["public_transport"="platform"][~"^(${PLATFORM_MODES.value.join('|')})$"~"^yes$"]${stationArea};`,
    `node["railway"="station"]["station"~"^(${STATION_NODE_TYPES.value.join('|')})$"]${stationArea};`,
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
  query: string,
  { instances = OVERPASS_INSTANCES, timeoutMs = CLIENT_TIMEOUT_MS, fetchImpl = fetch }: FetchOverpassOptions = {},
): Promise<OverpassResponse> {
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
