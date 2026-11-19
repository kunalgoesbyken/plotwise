import type { Assumption } from '@/site/assumptions'

export const CONTEXT_MARGIN_M: Assumption<number> = {
  value: 200,
  source:
    'assumption: 200 m around the plot covers the street block, the roads it faces and the towers that shade or overlook it',
}

export const REDEVELOPED_SHARE: Assumption<number> = {
  value: 0.5,
  source:
    'assumption: a mapped building with at least half its footprint inside the drawn plot stands on it and is cleared for the new design; less is a neighbour the outline only grazes',
}
