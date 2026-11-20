import type { Assumption } from '@/site/assumptions'

export const SEARCH_RESULT_LIMIT: Assumption<number> = {
  value: 6,
  source: 'assumption: enough places to pick from in a short list without scrolling',
}

export const PLACES_CACHE_S: Assumption<{ browser: number; cdn: number; staleWhileRevalidate: number }> = {
  value: { browser: 86_400, cdn: 604_800, staleWhileRevalidate: 2_592_000 },
  source:
    'assumption: place names and positions change over months, and the public Photon instance asks users to be fair (photon.komoot.io, 2026-11-20), so answers are cached hard',
}
