import type { NextRequest } from 'next/server'
import type { z } from 'zod'
import { ROUTE_RATE_LIMITS } from '@/rate-limit/assumptions'
import { createRateLimitGuard } from '@/rate-limit/guard'
import { regionParam, REGIONS } from '@/region/regions'
import { SITE_CACHE_S } from '@/site/assumptions'
import { bboxParamSchema } from '@/site/bbox'
import { loadSite } from '@/site/load-site'

export const maxDuration = 60

const { browser, cdn, staleWhileRevalidate } = SITE_CACHE_S.value
const CACHEABLE = `public, max-age=${browser}, s-maxage=${cdn}, stale-while-revalidate=${staleWhileRevalidate}`
const UNCACHEABLE = 'no-store'
const rateLimited = createRateLimitGuard(ROUTE_RATE_LIMITS.value.site)

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
  const bbox = bboxParamSchema(REGIONS[region.data]).safeParse(searchParams.get('bbox'))
  if (!bbox.success) return failure(400, issuesOf(bbox.error))
  try {
    return Response.json(await loadSite(bbox.data, region.data), { headers: { 'Cache-Control': CACHEABLE } })
  } catch (error) {
    return failure(502, error instanceof Error ? error.message : 'Site data is unavailable')
  }
}
