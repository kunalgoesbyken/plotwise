import type { Assumption } from '@/site/assumptions'

export const ZONE_TIMEOUT_MS: Assumption<number> = {
  value: 2_000,
  source:
    'assumption: a spatial query on a small polygon layer answers well within two seconds, so a slower server is reported as an unchecked zone rather than keeping the user waiting',
}

export const ZONE_UNREACHABLE_MEMORY_MS: Assumption<number> = {
  value: 60_000,
  source:
    'assumption: a zone server that just failed is likely still down a minute later, so repeat checks skip it for that long instead of each waiting out the timeout',
}

export const ZONE_ANSWER_MEMORY_MS: Assumption<number> = {
  value: 3_600_000,
  source:
    'assumption: a city plan changes only by a new regulation, so an answer stays valid for the whole working session; an hour keeps the same drawing from querying the public server again',
}

export const ZONE_SLIVER_SHARE: Assumption<number> = {
  value: 0.01,
  source:
    'assumption: a zone holding under 1% of the plot is a boundary sliver from map generalisation or a corner drawn a metre off, not a second zone, so it is ignored; the plot is inside a zone when that zone holds the other 99% or more',
}

export const ZONE_RING_DECIMALS: Assumption<number> = {
  value: 5,
  source: 'assumption: five decimal degrees is about 1 m, finer than a zone boundary drawn at 1:10,000, and lets repeat checks share one cache entry',
}

export const ZONE_DEBOUNCE_MS: Assumption<number> = {
  value: 400,
  source: 'assumption: waits for a dragged corner to settle, so one drag sends one request rather than dozens',
}
