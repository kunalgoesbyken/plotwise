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

export const ZONE_GENERALISATION_DEGREES: Assumption<number> = {
  value: 0.000002,
  source:
    'assumption: the layer is asked to simplify zone boundaries by at most 0.000002 degrees (about 0.2 m), which keeps the answer small. A straight boundary across a convex plot is at most half its perimeter long, so a shift of d metres moves at most d × half the perimeter ÷ the area of the plot; a plot too narrow for 0.2 m to stay within the sliver share asks for less, with the coordinate rounding counted in, so a simplified boundary cannot turn a plot a metre or more across from inside to straddling',
}

export const ZONE_COORDINATE_DECIMALS: Assumption<number> = {
  value: 7,
  source:
    'assumption: the layer answers in seven decimal degrees, about 1 cm, so rounding its coordinates moves a boundary by under the sliver share of any plot a metre or more across',
}

export const ZONE_RING_DECIMALS: Assumption<number> = {
  value: 5,
  source: 'assumption: five decimal degrees is about 1 m, finer than a zone boundary drawn at 1:10,000, and lets repeat checks share one cache entry',
}

export const ZONE_DEBOUNCE_MS: Assumption<number> = {
  value: 400,
  source: 'assumption: waits for a dragged corner to settle, so one drag sends one request rather than dozens',
}
