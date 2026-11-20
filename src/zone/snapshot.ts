import { z } from 'zod'
import type { LngLat } from '@/geo/projection'
import { classifyShares } from './classify'
import { zoneShares } from './shares'
import type { ZoneSource } from './sources'
import type { ZoneVerdict } from './verdict'

const VertexSchema = z.tuple([z.number(), z.number()]).readonly()

export const ZoneSnapshotSchema = z
  .object({
    layer: z.url(),
    url: z.url(),
    where: z.string(),
    fetchedAt: z.iso.datetime(),
    via: z.string().min(1),
    featureCount: z.number().int(),
    features: z.array(z.object({ code: z.string(), rings: z.array(z.array(VertexSchema)) })),
  })
  .refine(({ featureCount, features }) => featureCount === features.length, 'featureCount does not match the features')

export type ZoneSnapshot = z.infer<typeof ZoneSnapshotSchema>

export function snapshotVerdict(source: ZoneSource, { features }: ZoneSnapshot, ring: readonly LngLat[]): ZoneVerdict {
  const shares = zoneShares(ring, features)
  const held = shares.reduce((sum, { share }) => sum + share, 0)
  return classifyShares(source, [...shares, { code: null, share: 1 - held }])
}

export async function fetchZoneSnapshot(source: ZoneSource, fetchImpl: typeof fetch = fetch): Promise<ZoneSnapshot> {
  const response = await fetchImpl(source.snapshot)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return ZoneSnapshotSchema.parse(await response.json())
}
