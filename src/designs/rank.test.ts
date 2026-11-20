import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import { DUBAI_EXAMPLE_PLOT, EXAMPLE_PLOT, MUMBAI_EXAMPLE_PLOT } from '@/plot/example-plot'
import type { Plot } from '@/plot/plot'
import { loadPack, type PackId } from '@/rules'
import { packInterpretations, solve } from '@/solve'
import type { Check } from './checks'
import { designs, type Design } from './designs'
import { headline } from './headline'
import type { TypologyId } from './massing'
import { dominates, rank, shownOption, type Difference, type Measure, type Ranked } from './rank'
import { AREA_TOLERANCE_SQM } from './tolerance'

const designedUnder = (packId: PackId, plot: Plot) => {
  const pack = loadPack(packId)
  return designs(solve(plot, pack, packInterpretations(pack)))
}

const [template] = designedUnder('bkk-y9', EXAMPLE_PLOT)

const FAILING: Check = { id: 'coverage', cites: [], status: 'fail', actual: 1, cmp: 'lte', limit: 0, unit: 'ratio' }
const TO_CHECK: Check = { id: 'use-station', cites: [], status: 'manual' }
const PASSING: Check = { ...FAILING, status: 'pass' }

const near = (step: number) => fc.tuple(fc.integer({ min: 0, max: 3 }), fc.constantFrom(0, 0.04, 0.09)).map(([n, jitter]) => n * step + jitter)
const onGrid = (step: number) => fc.integer({ min: 0, max: 3 }).map((n) => n * step)

function variant(value: (step: number) => fc.Arbitrary<number>): fc.Arbitrary<Design> {
  return fc
    .record({
      gfaSqm: value(100),
      heightM: value(3),
      openSpaceSqm: value(50),
      highRise: fc.boolean(),
      failing: fc.integer({ min: 0, max: 2 }),
      toCheck: fc.integer({ min: 0, max: 2 }),
    })
    .map(({ gfaSqm, heightM, openSpaceSqm, highRise, failing, toCheck }) => ({
      ...template,
      name: { ...template.name, highRise },
      metrics: { ...template.metrics, gfaSqm, heightM, openSpaceSqm },
      checks: [PASSING, ...Array<Check>(failing).fill(FAILING), ...Array<Check>(toCheck).fill(TO_CHECK)],
    }))
}

const options = fc.array(variant(near), { minLength: 1, maxLength: 5 })

const IDS: readonly TypologyId[] = ['podium-tower', 'slab', 'low-rise']

const named = fc.array(variant(near), { minLength: 1, maxLength: IDS.length }).map((all) => all.map((design, index) => ({ ...design, id: IDS[index] })))

const standingOf = (ranked: readonly Ranked[], design: Design) => ranked.find((r) => r.design === design)!.standing
const isShown = (ranked: readonly Ranked[], design: Design) => standingOf(ranked, design).kind !== 'same-as'
const measures = (differences: readonly Difference[]) => differences.map((d) => d.measure)

function amountOf(differences: readonly Difference[], measure: Measure): number | undefined {
  const found = differences.find((d) => d.measure === measure)
  return found && 'amount' in found ? found.amount : undefined
}

describe('ranking designs for the user to choose', () => {
  it('ranks nothing when no design fits', () => {
    expect(rank([])).toEqual([])
  })

  it('keeps every design in order and marks exactly one best, the headline design', () => {
    fc.assert(
      fc.property(options, (all) => {
        const ranked = rank(all)
        expect(ranked.map((r) => r.design)).toEqual(all)
        const best = ranked.filter((r) => r.standing.kind === 'best')
        expect(best.length).toBe(1)
        expect(best[0].design).toBe(headline(all)!)
      }),
    )
  })

  it('collapses a design only into a shown design it matches on every measure, open space included', () => {
    fc.assert(
      fc.property(options, (all) => {
        const ranked = rank(all)
        for (const { design, standing } of ranked) {
          if (standing.kind !== 'same-as') continue
          expect(isShown(ranked, standing.of)).toBe(true)
          expect(standing.of).not.toBe(design)
          expect(dominates(standing.of, design)).toBe(false)
          expect(dominates(design, standing.of)).toBe(false)
          expect(Math.abs(standing.of.metrics.openSpaceSqm - design.metrics.openSpaceSqm)).toBeLessThanOrEqual(AREA_TOLERANCE_SQM)
        }
      }),
    )
  })

  it('greys a design only for a shown design that dominates it, naming where it is worse and where it still has more open space', () => {
    fc.assert(
      fc.property(options, (all) => {
        const ranked = rank(all)
        for (const { design, standing } of ranked) {
          if (standing.kind !== 'dominated') continue
          expect(isShown(ranked, standing.by)).toBe(true)
          expect(dominates(standing.by, design)).toBe(true)
          expect(standing.worse.length).toBeGreaterThan(0)
          expect(measures(standing.better).every((m) => m === 'open-space')).toBe(true)
          for (const { amount } of standing.worse.filter((d) => 'amount' in d)) expect(amount).toBeGreaterThan(0)
        }
      }),
    )
  })

  it('shows every other design as an alternative that no shown design dominates, with something it offers over the best', () => {
    fc.assert(
      fc.property(options, (all) => {
        const ranked = rank(all)
        const best = headline(all)!
        for (const { design, standing } of ranked) {
          if (standing.kind !== 'alternative') continue
          expect(standing.over).toBe(best)
          expect(standing.better.length).toBeGreaterThan(0)
          for (const shown of all.filter((d) => isShown(ranked, d))) expect(dominates(shown, design)).toBe(false)
        }
      }),
    )
  })

  it('never lets a design dominate itself, nor two designs dominate each other', () => {
    fc.assert(
      fc.property(variant(near), variant(near), (a, b) => {
        expect(dominates(a, a)).toBe(false)
        expect(dominates(a, b) && dominates(b, a)).toBe(false)
      }),
    )
  })

  it('is transitive when measures differ by more than the tolerance or not at all', () => {
    fc.assert(
      fc.property(variant(onGrid), variant(onGrid), variant(onGrid), (a, b, c) => {
        if (dominates(a, b) && dominates(b, c)) expect(dominates(a, c)).toBe(true)
      }),
    )
  })

  it('greys a design that ties another on every compared measure but has less open space', () => {
    const roomier: Design = { ...template, metrics: { ...template.metrics, openSpaceSqm: template.metrics.openSpaceSqm + 50 } }
    const [first, second] = rank([roomier, template])
    expect(first.standing.kind).toBe('best')
    expect(second.standing).toEqual({ kind: 'dominated', by: roomier, worse: [{ measure: 'open-space', amount: 50 }], better: [] })
  })
})

describe('choosing the design to show', () => {
  it('shows nothing when no design fits', () => {
    expect(shownOption([], null)).toBeNull()
  })

  it('shows the best design when none is chosen or the chosen one no longer fits', () => {
    fc.assert(
      fc.property(named, (all) => {
        const ranked = rank(all.slice(1))
        if (ranked.length === 0) return
        const best = ranked.find((r) => r.standing.kind === 'best')
        expect(shownOption(ranked, null)).toBe(best!)
        expect(shownOption(ranked, all[0].id)).toBe(best!)
      }),
    )
  })

  it('shows a chosen design as is, and a chosen duplicate as the design it duplicates', () => {
    fc.assert(
      fc.property(named, fc.nat(), (all, pick) => {
        const ranked = rank(all)
        const { design, standing } = ranked[pick % ranked.length]
        const shown = shownOption(ranked, design.id)!
        expect(shown.standing.kind).not.toBe('same-as')
        expect(shown.design).toBe(standing.kind === 'same-as' ? standing.of : design)
      }),
    )
  })

  it('shows the design a chosen duplicate collapses into, so the pressed column, the 3D and the summary agree', () => {
    const twin: Design = { ...template, id: IDS.find((id) => id !== template.id)! }
    const ranked = rank([template, twin])
    expect(standingOf(ranked, twin)).toEqual({ kind: 'same-as', of: template })
    expect(shownOption(ranked, twin.id)!.design).toBe(template)
  })
})

describe('ranking the example designs', () => {
  it('on the Bangkok example, greys both towers against the low block: less floor area, taller, high-rise, more to check, with their extra open space shown', () => {
    const all = designedUnder('bkk-y9', EXAMPLE_PLOT)
    const best = headline(all)!
    expect(best.name.highRise).toBe(false)
    const ranked = rank(all)
    const towers = all.filter((d) => d !== best)
    expect(towers.length).toBeGreaterThan(0)
    for (const design of towers) {
      const standing = standingOf(ranked, design)
      expect(standing).toMatchObject({ kind: 'dominated', by: best })
      if (standing.kind !== 'dominated') continue
      expect(measures(standing.worse)).toEqual(expect.arrayContaining(['floor-area', 'height', 'high-rise', 'to-check']))
      expect(amountOf(standing.worse, 'floor-area')).toBeCloseTo(best.metrics.gfaSqm - design.metrics.gfaSqm, 6)
      expect(amountOf(standing.better, 'open-space')).toBeCloseTo(design.metrics.openSpaceSqm - best.metrics.openSpaceSqm, 6)
    }
  })

  it('on the Mumbai example, resolves the tie at the cap by height, and shows the open space the taller design keeps', () => {
    const all = designedUnder('mum-suburbs-res', MUMBAI_EXAMPLE_PLOT)
    const best = headline(all)!
    const tied = all.filter((d) => d !== best && Math.abs(d.metrics.gfaSqm - best.metrics.gfaSqm) <= AREA_TOLERANCE_SQM)
    expect(tied.length).toBeGreaterThan(0)
    const ranked = rank(all)
    for (const design of tied) {
      const standing = standingOf(ranked, design)
      expect(standing).toMatchObject({ kind: 'dominated', by: best })
      if (standing.kind !== 'dominated') continue
      expect(measures(standing.worse)).toEqual(['height'])
      expect(amountOf(standing.worse, 'height')).toBeCloseTo(design.metrics.heightM - best.metrics.heightM, 6)
      expect(amountOf(standing.better, 'open-space')).toBeCloseTo(design.metrics.openSpaceSqm - best.metrics.openSpaceSqm, 6)
    }
  })

  it('on the Dubai example, greys the slab for less floor area at the same height, and shows its small open-space gain', () => {
    const all = designedUnder('dxb-ap', DUBAI_EXAMPLE_PLOT)
    const best = headline(all)!
    const ranked = rank(all)
    const others = all.filter((d) => d !== best)
    expect(others.length).toBeGreaterThan(0)
    for (const design of others) {
      const standing = standingOf(ranked, design)
      expect(standing).toMatchObject({ kind: 'dominated', by: best })
      if (standing.kind !== 'dominated') continue
      expect(measures(standing.worse)).toEqual(['floor-area'])
      expect(measures(standing.better)).toEqual(['open-space'])
    }
  })
})
