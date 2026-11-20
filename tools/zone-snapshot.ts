import { z } from 'zod'
import { parseZoneFeatures } from '../src/zone/arcgis'
import { coveredEntry } from '../src/zone/classify'
import { ZoneSnapshotSchema, type ZoneSnapshot } from '../src/zone/snapshot'
import { ZONE_SOURCES, type ZoneSource } from '../src/zone/sources'

const WGS84 = 4326

const SavedResponseSchema = z.object({
  fetchedAt: z.iso.datetime(),
  url: z.url(),
  via: z.string().min(1),
  body: z.unknown(),
})

const QueryAnswerSchema = z.object({
  spatialReference: z.object({ wkid: z.number() }),
  exceededTransferLimit: z.boolean().optional(),
  features: z.array(z.unknown()),
})

function coveredQuery({ layer, naming }: ZoneSource, url: string): string {
  const query = new URL(url)
  if (`${query.origin}${query.pathname}` !== `${layer.url}/query`) throw new Error(`${url} is not a query of ${layer.url}`)
  const expected = `${layer.zoneField}='${coveredEntry(naming).sourceCode}'`
  const where = query.searchParams.get('where')
  if (where !== expected) throw new Error(`the query asks for ${where}, not every feature with ${expected}`)
  return where
}

export function zoneSnapshot(saved: unknown, source: ZoneSource): ZoneSnapshot {
  const { fetchedAt, url, via, body } = SavedResponseSchema.parse(saved)
  const where = coveredQuery(source, url)
  const features = parseZoneFeatures(source.layer, body)
  const answer = QueryAnswerSchema.parse(body)
  if (answer.exceededTransferLimit) throw new Error('the layer cut the answer short (exceededTransferLimit); query it in pages')
  if (answer.spatialReference.wkid !== WGS84) throw new Error(`coordinates are in wkid ${answer.spatialReference.wkid}, not ${WGS84}`)
  if (features.length !== answer.features.length) throw new Error('a feature has no zone code or no geometry')
  const { sourceCode } = coveredEntry(source.naming)
  const other = features.find(({ code }) => code !== sourceCode)
  if (other) throw new Error(`a feature is zone ${other.code}, not ${sourceCode}`)
  return ZoneSnapshotSchema.parse({ layer: source.layer.url, url, where, fetchedAt, via, featureCount: features.length, features })
}

export const snapshotJson = (snapshot: ZoneSnapshot) => `${JSON.stringify(snapshot)}\n`

const RegionSchema = z.enum(Object.keys(ZONE_SOURCES) as [keyof typeof ZONE_SOURCES])

if (import.meta.main) {
  const [regionId, savedPath] = Bun.argv.slice(2)
  if (!regionId || !savedPath) {
    console.error('usage: bun tools/zone-snapshot.ts <regionId> <saved ArcGIS query response.json>')
    process.exit(1)
  }
  const source = ZONE_SOURCES[RegionSchema.parse(regionId)]
  const snapshot = zoneSnapshot(await Bun.file(savedPath).json(), source)
  await Bun.write(`${import.meta.dir}/../public${source.snapshot}`, snapshotJson(snapshot))
  console.log(`wrote ${snapshot.featureCount} features of ${snapshot.where} fetched ${snapshot.fetchedAt} to public${source.snapshot}`)
}
