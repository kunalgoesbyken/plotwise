import type { NextRequest } from 'next/server'
import { SITE_CACHE_S } from '@/site/assumptions'
import { BboxParamSchema } from '@/site/bbox'
import { loadSite } from '@/site/load-site'

export const maxDuration = 60

const { browser, cdn, staleWhileRevalidate } = SITE_CACHE_S.value
const CACHEABLE = `public, max-age=${browser}, s-maxage=${cdn}, stale-while-revalidate=${staleWhileRevalidate}`
const UNCACHEABLE = 'no-store'

function failure(status: number, error: string): Response {
  return Response.json({ error }, { status, headers: { 'Cache-Control': UNCACHEABLE } })
}

export async function GET(request: NextRequest): Promise<Response> {
  const bbox = BboxParamSchema.safeParse(request.nextUrl.searchParams.get('bbox'))
  if (!bbox.success) return failure(400, bbox.error.issues.map((issue) => issue.message).join('; '))
  try {
    return Response.json(await loadSite(bbox.data), { headers: { 'Cache-Control': CACHEABLE } })
  } catch (error) {
    return failure(502, error instanceof Error ? error.message : 'Site data is unavailable')
  }
}
