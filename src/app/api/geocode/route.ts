import type { NextRequest } from 'next/server'
import type { z } from 'zod'
import { PLACES_CACHE_S } from '@/geocode/assumptions'
import { loadPlaces } from '@/geocode/load-places'
import { PlaceQuerySchema } from '@/geocode/schema'
import { ROUTE_RATE_LIMITS } from '@/rate-limit/assumptions'
import { createRateLimitGuard } from '@/rate-limit/guard'
import { regionParam } from '@/region/regions'

export const maxDuration = 15

const { browser, cdn, staleWhileRevalidate } = PLACES_CACHE_S.value
const CACHEABLE = `public, max-age=${browser}, s-maxage=${cdn}, stale-while-revalidate=${staleWhileRevalidate}`
const UNCACHEABLE = 'no-store'
const UNAVAILABLE = 'Place search is unavailable right now; try again shortly'
const rateLimited = createRateLimitGuard(ROUTE_RATE_LIMITS.value.geocode)

const issuesOf = (error: z.ZodError) => error.issues.map((issue) => issue.message).join('; ')

function failure(status: number, error: string): Response {
  return Response.json({ error }, { status, headers: { 'Cache-Control': UNCACHEABLE } })
}

export async function GET(request: NextRequest): Promise<Response> {
  const refused = rateLimited(request)
  if (refused) return refused
  const { searchParams } = request.nextUrl
  const region = regionParam(searchParams.get('region'))
  if (!region.success) return failure(400, issuesOf(region.error))
  const query = PlaceQuerySchema.safeParse(searchParams.get('q'))
  if (!query.success) return failure(400, issuesOf(query.error))
  try {
    return Response.json(await loadPlaces(query.data, region.data), { headers: { 'Cache-Control': CACHEABLE } })
  } catch {
    return failure(502, UNAVAILABLE)
  }
}
