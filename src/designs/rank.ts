import { ASSUMPTIONS } from '@/solve'
import type { Check } from './checks'
import type { Design } from './designs'
import { headline } from './headline'
import type { TypologyId } from './massing'
import { AREA_TOLERANCE_SQM, HEIGHT_TOLERANCE_M } from './tolerance'

export type Measure = 'floor-area' | 'height' | 'high-rise' | 'failing-checks' | 'to-check' | 'open-space'

export type Difference = { readonly measure: Exclude<Measure, 'high-rise'>; readonly amount: number } | { readonly measure: 'high-rise' }

export type Standing =
  | { readonly kind: 'best' }
  | { readonly kind: 'same-as'; readonly of: Design }
  | { readonly kind: 'dominated'; readonly by: Design; readonly worse: readonly Difference[]; readonly better: readonly Difference[] }
  | { readonly kind: 'alternative'; readonly over: Design; readonly better: readonly Difference[] }

export type Ranked = { readonly design: Design; readonly standing: Standing }

type Scale = { readonly gain: (design: Design) => number; readonly tolerance: (a: number, b: number) => number }

const counted = (design: Design, status: Check['status']) => design.checks.filter((check) => check.status === status).length

const fixed = (tolerance: number) => () => tolerance

const shareOfSmaller = (a: number, b: number) => Math.max(AREA_TOLERANCE_SQM, ASSUMPTIONS.sameDesignShare.value * Math.min(a, b))

const SCALES: Readonly<Record<Measure, Scale>> = {
  'floor-area': { gain: (d) => d.metrics.gfaSqm, tolerance: shareOfSmaller },
  height: { gain: (d) => -d.metrics.heightM, tolerance: fixed(HEIGHT_TOLERANCE_M) },
  'high-rise': { gain: (d) => (d.name.highRise ? -1 : 0), tolerance: fixed(0) },
  'failing-checks': { gain: (d) => -counted(d, 'fail'), tolerance: fixed(0) },
  'to-check': { gain: (d) => -counted(d, 'manual'), tolerance: fixed(0) },
  'open-space': { gain: (d) => d.metrics.openSpaceSqm, tolerance: shareOfSmaller },
}

const MEASURES = Object.keys(SCALES) as Measure[]

const COMPARED = MEASURES.filter((measure) => measure !== 'open-space')

const lead = (measure: Measure, a: Design, b: Design) => SCALES[measure].gain(a) - SCALES[measure].gain(b)

function ahead(measure: Measure, a: Design, b: Design): boolean {
  const { gain, tolerance } = SCALES[measure]
  const [gainA, gainB] = [gain(a), gain(b)]
  return gainA - gainB > tolerance(gainA, gainB)
}

const alike = (a: Design, b: Design) => MEASURES.every((measure) => !ahead(measure, a, b) && !ahead(measure, b, a))

export function dominates(a: Design, b: Design): boolean {
  if (COMPARED.some((measure) => ahead(measure, b, a))) return false
  return COMPARED.some((measure) => ahead(measure, a, b)) || ahead('open-space', a, b)
}

const differenceIn = (measure: Measure, design: Design, other: Design): Difference =>
  measure === 'high-rise' ? { measure } : { measure, amount: Math.abs(lead(measure, design, other)) }

const differences = (design: Design, other: Design, side: (measure: Measure) => boolean) =>
  MEASURES.filter(side).map((measure) => differenceIn(measure, design, other))

const worseThan = (design: Design, other: Design) => differences(design, other, (measure) => ahead(measure, other, design))

const betterThan = (design: Design, other: Design) => differences(design, other, (measure) => ahead(measure, design, other))

function standingOf(design: Design, best: Design, shown: readonly Design[]): Standing {
  if (design === best) return { kind: 'best' }
  const twin = shown.find((other) => other !== design && alike(other, design))
  if (twin) return { kind: 'same-as', of: twin }
  const by = shown.find((other) => dominates(other, design))
  if (by) return { kind: 'dominated', by, worse: worseThan(design, by), better: betterThan(design, by) }
  return { kind: 'alternative', over: best, better: betterThan(design, best) }
}

export function rank(designs: readonly Design[]): readonly Ranked[] {
  const best = headline(designs)
  if (!best) return []
  const shown = designs.reduce<readonly Design[]>((kept, design) => (kept.some((other) => alike(other, design)) ? kept : [...kept, design]), [best])
  return designs.map((design) => ({ design, standing: standingOf(design, best, shown) }))
}

export function shownOption(ranked: readonly Ranked[], chosen: TypologyId | null): Ranked | null {
  const option = ranked.find(({ design }) => design.id === chosen) ?? ranked.find(({ standing }) => standing.kind === 'best')
  if (option?.standing.kind !== 'same-as') return option ?? null
  const { of } = option.standing
  return ranked.find(({ design }) => design === of) ?? null
}
