import type { Assumption } from '@/site/assumptions'

export const ZONE_TIMEOUT_MS: Assumption<number> = {
  value: 8_000,
  source:
    'assumption: a spatial query on a small polygon layer answers within seconds, so a longer wait is better reported as an unchecked zone',
}

export const ZONE_CACHE_S: Assumption<{ browser: number; cdn: number; staleWhileRevalidate: number }> = {
  value: { browser: 3_600, cdn: 86_400, staleWhileRevalidate: 604_800 },
  source:
    'assumption: a zone map changes only by a new ministerial regulation, and the public ArcGIS server is slow and not ours to hammer, so answers are cached hard',
}

export const ZONE_RING_DECIMALS: Assumption<number> = {
  value: 5,
  source: 'assumption: five decimal degrees is about 1 m, finer than a zone boundary drawn at 1:10,000, and lets repeat checks share one cache entry',
}

export const ZONE_MAX_VERTICES: Assumption<number> = {
  value: 64,
  source: 'assumption: a plot outline has a handful of corners; more than this is not a plot and would only bloat the query URL',
}

export const ZONE_DEBOUNCE_MS: Assumption<number> = {
  value: 400,
  source: 'assumption: waits for a dragged corner to settle, so one drag sends one request rather than dozens',
}
