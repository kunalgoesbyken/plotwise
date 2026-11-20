import { describe, expect, it } from 'bun:test'
import { ZONE_SOURCES } from '../src/zone/sources'
import { snapshotJson, zoneSnapshot } from './zone-snapshot'

const { bkk } = ZONE_SOURCES
const BROWN_9 = 'ย.๙'
const FETCHED_AT = '2026-11-20T14:55:43.127073Z'
const VIA = 'Firecrawl scrape, location TH, proxy basic'

const queryUrl = (where = `LUP_ZONE='${BROWN_9}'`, layerUrl = bkk.layer.url) =>
  `${layerUrl}/query?${new URLSearchParams({ f: 'json', where, outFields: 'OBJECTID,LUP_ZONE', returnGeometry: 'true', outSR: '4326', geometryPrecision: '7' })}`

const ring: [number, number][] = [
  [100.5612345, 13.7512345],
  [100.5612345, 13.7598765],
  [100.5698765, 13.7598765],
  [100.5698765, 13.7512345],
  [100.5612345, 13.7512345],
]

const feature = (code: string = BROWN_9, rings: [number, number][][] | null = [ring]) => ({
  attributes: { OBJECTID: 117, LUP_ZONE: code },
  geometry: rings && { rings },
})

const body = (overrides: Record<string, unknown> = {}) => ({
  displayFieldName: 'LUP_ZONE',
  geometryType: 'esriGeometryPolygon',
  spatialReference: { wkid: 4326, latestWkid: 4326 },
  features: [feature(), feature(BROWN_9, [ring, [...ring].reverse()])],
  ...overrides,
})

const saved = (answer: unknown = body(), url = queryUrl()) => ({ fetchedAt: FETCHED_AT, url, via: VIA, scrapeId: 'scrape-1', body: answer })

describe('zoneSnapshot', () => {
  it('records where, when and how the layer was read, with every feature as it came', () => {
    const snapshot = zoneSnapshot(saved(), bkk)
    expect(snapshot).toEqual({
      layer: bkk.layer.url,
      url: queryUrl(),
      where: `LUP_ZONE='${BROWN_9}'`,
      fetchedAt: FETCHED_AT,
      via: VIA,
      featureCount: 2,
      features: [
        { code: BROWN_9, rings: [ring] },
        { code: BROWN_9, rings: [ring, [...ring].reverse()] },
      ],
    })
  })

  it('writes the same bytes for the same response', () => {
    expect(snapshotJson(zoneSnapshot(saved(), bkk))).toBe(snapshotJson(zoneSnapshot(structuredClone(saved()), bkk)))
    expect(snapshotJson(zoneSnapshot(saved(), bkk)).endsWith('}\n')).toBe(true)
  })

  it('refuses a response the layer cut short', () => {
    expect(() => zoneSnapshot(saved(body({ exceededTransferLimit: true })), bkk)).toThrow('exceededTransferLimit')
  })

  it('refuses an ArcGIS error body', () => {
    expect(() => zoneSnapshot(saved({ error: { code: 400, message: 'Invalid query' } }), bkk)).toThrow('Invalid query')
  })

  it('refuses a feature of any other zone', () => {
    expect(() => zoneSnapshot(saved(body({ features: [feature(), feature('ย.๘')] })), bkk)).toThrow('ย.๘')
  })

  it('refuses a feature with no geometry', () => {
    expect(() => zoneSnapshot(saved(body({ features: [feature(), feature(BROWN_9, null)] })), bkk)).toThrow('no zone code or no geometry')
  })

  it('refuses coordinates in any spatial reference but WGS 84', () => {
    expect(() => zoneSnapshot(saved(body({ spatialReference: { wkid: 32647, latestWkid: 32647 } })), bkk)).toThrow('32647')
  })

  it('refuses an answer from another layer or to a query for another zone', () => {
    expect(() => zoneSnapshot(saved(body(), queryUrl(undefined, `${bkk.layer.url}0`)), bkk)).toThrow('not a query of')
    expect(() => zoneSnapshot(saved(body(), queryUrl('1=1')), bkk)).toThrow(`LUP_ZONE='${BROWN_9}'`)
  })

  it('refuses a saved file without its fetch date or provenance', () => {
    expect(() => zoneSnapshot({ url: queryUrl(), body: body() }, bkk)).toThrow()
    expect(() => zoneSnapshot({ ...saved(), fetchedAt: '20 Nov 2026' }, bkk)).toThrow()
  })
})
