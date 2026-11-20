import { expect, type APIRequestContext, type APIResponse } from '@playwright/test'

export type CacheTimes = { readonly browser: number; readonly cdn: number; readonly staleWhileRevalidate: number }

const CDN_ANSWERED_FROM_CACHE = /^(HIT|STALE)$/

const isLive = () => Boolean(process.env.E2E_URL)

function expectedCacheControl({ browser, cdn, staleWhileRevalidate }: CacheTimes): string {
  const browserDirectives = `public, max-age=${browser}`
  return isLive() ? browserDirectives : `${browserDirectives}, s-maxage=${cdn}, stale-while-revalidate=${staleWhileRevalidate}`
}

export function expectPublicCacheControl(response: APIResponse, times: CacheTimes) {
  expect(response.headers()['cache-control']).toBe(expectedCacheControl(times))
}

export async function expectCdnToCache(request: APIRequestContext, url: string, headers?: Record<string, string>) {
  if (!isLive()) return
  await expect
    .poll(async () => (await request.get(url, { headers })).headers()['x-vercel-cache'], { intervals: [500, 1_000, 2_000] })
    .toMatch(CDN_ANSWERED_FROM_CACHE)
}
