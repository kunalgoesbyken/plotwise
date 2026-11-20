import type { NextRequest } from 'next/server'
import { ROUTE_RATE_LIMITS } from '@/rate-limit/assumptions'
import { createRateLimitGuard } from '@/rate-limit/guard'
import { ZoneServiceUnavailableError } from '@/zone/arcgis'
import { ZONE_CACHE_S } from '@/zone/assumptions'
import { sourceFor, unknownVerdict } from '@/zone/classify'
import { lookupZone } from '@/zone/lookup'
import { RingParamSchema } from '@/zone/schema'

export const maxDuration = 15

const { browser, cdn, staleWhileRevalidate } = ZONE_CACHE_S.value
const CACHEABLE = `public, max-age=${browser}, s-maxage=${cdn}, stale-while-revalidate=${staleWhileRevalidate}`
const UNCACHEABLE = 'no-store'
const rateLimited = createRateLimitGuard(ROUTE_RATE_LIMITS.value.zone)

export async function GET(request: NextRequest): Promise<Response> {
  const refused = rateLimited(request)
  if (refused) return refused
  const ring = RingParamSchema.safeParse(request.nextUrl.searchParams.get('ring'))
  if (!ring.success) {
    const error = [...new Set(ring.error.issues.map((issue) => issue.message))].join('; ')
    return Response.json({ error }, { status: 400, headers: { 'Cache-Control': UNCACHEABLE } })
  }
  try {
    return Response.json(await lookupZone(ring.data), { headers: { 'Cache-Control': CACHEABLE } })
  } catch (error) {
    if (error instanceof ZoneServiceUnavailableError) {
      return Response.json(unknownVerdict(sourceFor(ring.data), 'unreachable'), { headers: { 'Cache-Control': UNCACHEABLE } })
    }
    return Response.json({ error: 'Zone check failed' }, { status: 502, headers: { 'Cache-Control': UNCACHEABLE } })
  }
}
