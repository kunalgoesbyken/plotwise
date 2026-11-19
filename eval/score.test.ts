import { describe, expect, it } from 'bun:test'
import fc from 'fast-check'
import { RulePackSchema } from '../src/rules/types'
import type { Field, Truth } from './inputs'
import { accuracy, agreement, coverage, invariantErrors, pointAnswers, sameValue, valueAt, withValues, writeAnswers } from './metrics'
import { renderResults } from './report'
import { score } from './score'

const pack = RulePackSchema.parse(await Bun.file(`${import.meta.dir}/../src/rules/packs/bkk-y9.json`).json())

const field = (path: string, source = 'src-a', page = 1): Field => ({ path, source, clause: 'ข้อ 1', page })
const FIELDS = [field('far.max'), field('openSpaceRatio.minShareOfFloorArea'), field('blindWall.minDistanceM', 'src-b', 2)]
const cite = { url: 'https://example.org/a', title: 'A', quote: 'q' }
const TRUTH: Truth = {
  'far.max': { value: 7, sources: [cite] },
  'openSpaceRatio.minShareOfFloorArea': {
    disputed: true,
    sources: [
      { ...cite, value: 0.045 },
      { ...cite, url: 'https://example.org/b', value: 0.05 },
    ],
  },
}

describe('sameValue', () => {
  it('matches equal numbers and tolerates float noise', () => {
    expect(sameValue('far.max', 7, 7)).toBe(true)
    expect(sameValue('far.max', 0.1 + 0.2, 0.3)).toBe(true)
    expect(sameValue('far.max', 7, 8)).toBe(false)
  })

  it('reads a share above 1 as a percentage', () => {
    expect(sameValue('openSpaceMinimums[0].minShare', 30, 0.3)).toBe(true)
    expect(sameValue('farBonus.measures[3].baseShare', 0.05, 5)).toBe(true)
    expect(sameValue('openSpaceRatio.permeableShareOfOpenSpace', 50, 0.5)).toBe(true)
  })

  it('does not rescale lengths, areas or counts', () => {
    expect(sameValue('blindWall.minDistanceM', 50, 0.5)).toBe(false)
    expect(sameValue('far.max', 30, 0.3)).toBe(false)
  })

  it('is reflexive and symmetric', () => {
    const path = fc.constantFrom('far.max', 'roadSetbacks[0].bands[1].setback.share', 'parking[0].hallSqmPerSpace')
    const value = fc.double({ min: 0, max: 1e6, noNaN: true })
    fc.assert(fc.property(path, value, value, (p, a, b) => sameValue(p, a, a) && sameValue(p, a, b) === sameValue(p, b, a)))
  })
})

describe('reading and writing pack values by path', () => {
  it('reads a cited value, a bound and an indexed band', () => {
    expect(valueAt(pack, 'far.max')).toBe(pack.far.max.value)
    expect(valueAt(pack, 'roadSetbacks[0].bands[1].roadWidthM.max')).toBe(pack.roadSetbacks[0].bands[1].roadWidthM.max!.value)
    expect(valueAt(pack, 'heightVsRoad.maxMultipleOfDistance[1]')).toBe(pack.heightVsRoad.maxMultipleOfDistance[1].value)
  })

  it('returns null for a path the pack does not have', () => {
    expect(valueAt(pack, 'far.min')).toBeNull()
    expect(valueAt(pack, 'roadSetbacks[9].bands[0].setback.distanceM')).toBeNull()
  })

  it('writes into a copy, skips unresolved answers and leaves the pack untouched', () => {
    const before = pack.blindWall.minDistanceM.value
    const changed = withValues(pack, { 'blindWall.minDistanceM': before + 1, 'far.max': null })
    expect(valueAt(changed, 'blindWall.minDistanceM')).toBe(before + 1)
    expect(valueAt(changed, 'far.max')).toBe(pack.far.max.value)
    expect(pack.blindWall.minDistanceM.value).toBe(before)
  })

  it('refuses to write a path the pack does not have', () => {
    expect(() => withValues(pack, { 'far.min': 1 })).toThrow('far.min')
  })
})

describe('answers per method', () => {
  it('reads every field from the pack for the point method', () => {
    expect(pointAnswers(pack, FIELDS)).toEqual({
      'far.max': pack.far.max.value,
      'openSpaceRatio.minShareOfFloorArea': pack.openSpaceRatio.minShareOfFloorArea.value,
      'blindWall.minDistanceM': pack.blindWall.minDistanceM.value,
    })
  })

  it('treats a field missing from a write run as unresolved', () => {
    const run = { fields: { 'far.max': { value: 7, page: 1, quote: 'q' } } }
    expect(writeAnswers(run, FIELDS)).toEqual({ 'far.max': 7, 'openSpaceRatio.minShareOfFloorArea': null, 'blindWall.minDistanceM': null })
  })
})

describe('coverage', () => {
  it('counts answered and unresolved fields', () => {
    expect(coverage({ 'far.max': 7, 'openSpaceRatio.minShareOfFloorArea': null, 'blindWall.minDistanceM': 0.5 }, FIELDS)).toEqual({
      total: 3,
      answered: 2,
      unresolved: 1,
    })
  })
})

describe('accuracy against ground truth', () => {
  it('scores agreed fields and counts disputed ones separately', () => {
    expect(accuracy({ 'far.max': 7, 'openSpaceRatio.minShareOfFloorArea': 0.05, 'blindWall.minDistanceM': 1 }, TRUTH)).toEqual({
      total: 1,
      correct: 1,
      wrong: [],
      unanswered: 0,
      disputed: { total: 1, matched: 1 },
    })
  })

  it('lists wrong fields and counts unanswered ones', () => {
    expect(accuracy({ 'far.max': 8, 'openSpaceRatio.minShareOfFloorArea': null }, TRUTH)).toEqual({
      total: 1,
      correct: 0,
      wrong: ['far.max'],
      unanswered: 0,
      disputed: { total: 1, matched: 0 },
    })
    expect(accuracy({ 'far.max': null }, TRUTH).unanswered).toBe(1)
  })
})

describe('agreement between two methods', () => {
  it('compares only fields both answered and lists the differences', () => {
    const a = { 'far.max': 7, 'openSpaceRatio.minShareOfFloorArea': 0.045, 'blindWall.minDistanceM': null }
    const b = { 'far.max': 7, 'openSpaceRatio.minShareOfFloorArea': 5, 'blindWall.minDistanceM': 0.5 }
    expect(agreement(a, b, FIELDS)).toEqual({ compared: 2, agreed: 1, differing: ['openSpaceRatio.minShareOfFloorArea'] })
  })

  it('is symmetric', () => {
    const answer = fc.option(fc.integer({ min: 0, max: 3 }), { nil: null })
    const answers = fc.tuple(answer, answer, answer).map(([x, y, z]) => ({
      'far.max': x,
      'openSpaceRatio.minShareOfFloorArea': y,
      'blindWall.minDistanceM': z,
    }))
    fc.assert(fc.property(answers, answers, (a, b) => expect(agreement(a, b, FIELDS)).toEqual(agreement(b, a, FIELDS))))
  })
})

describe('invariant checks on substituted values', () => {
  it('finds nothing when the values are the pack values', () => {
    expect(invariantErrors(pack, pointAnswers(pack, FIELDS))).toEqual([])
  })

  it('catches a boundary distance that shrinks as buildings get taller', () => {
    const errors = invariantErrors(pack, { 'boundarySetbacks[0].bands[0].distanceM': 5, 'boundarySetbacks[0].bands[1].distanceM': 1 })
    expect(errors.join('\n')).toContain('boundarySetbacks.0 decreases')
  })

  it('leaves unresolved fields at the pack value', () => {
    expect(invariantErrors(pack, { 'far.max': null })).toEqual([])
  })
})

describe('score', () => {
  const sources = { 'src-a': [['FAR ไม่เกิน ๗ : ๑']], 'src-b': [['x'], ['ห่างไม่น้อยกว่า ๕๐ เซนติเมตร']] }
  const writeRun = {
    fields: {
      'far.max': { value: 7, page: 1, quote: 'FAR ไม่เกิน ๗' },
      'blindWall.minDistanceM': { value: 0.5, page: 2, quote: 'ไม่น้อยกว่า ๕๐ เซนติเมตร' },
    },
  }
  const results = score({ fields: FIELDS, truth: TRUTH, pack, compileErrors: [], runs: [{ name: 'write-1', run: writeRun }], sources })

  it('scores the point method and every write run', () => {
    expect(results.methods.map((m) => m.name)).toEqual(['point', 'write-1'])
    expect(results.methods[1].coverage).toEqual({ total: 3, answered: 2, unresolved: 1 })
    expect(results.methods[1].accuracy.correct).toBe(1)
    expect(results.methods[1].grounding).toEqual({ answered: 2, quoteFound: 2, valueOnPage: 2, valueInQuote: 2, ungrounded: [] })
    expect(results.methods[0].grounding).toBeNull()
  })

  it('pairs point with each write run and write runs with each other', () => {
    const second = { name: 'write-2', run: { fields: { 'far.max': { value: 8, page: 1, quote: 'FAR' } } } }
    const both = score({ fields: FIELDS, truth: TRUTH, pack, compileErrors: [], runs: [{ name: 'write-1', run: writeRun }, second], sources })
    expect(both.pairs.map((p) => `${p.a} vs ${p.b}`)).toEqual(['point vs write-1', 'point vs write-2', 'write-1 vs write-2'])
    expect(both.pairs[2].result.differing).toEqual(['far.max'])
  })

  it('counts compile rejections and check errors as caught for the point method', () => {
    const rejected = score({ fields: FIELDS, truth: TRUTH, pack, compileErrors: ['token_not_on_line at far.max'], runs: [], sources })
    expect(rejected.methods[0].caught).toEqual(['token_not_on_line at far.max'])
  })
})

describe('renderResults', () => {
  const sources = { 'src-a': [['๗']], 'src-b': [['x'], ['y']] }
  const runs = [
    { name: 'write-1', run: { fields: { 'far.max': { value: 6, page: 1, quote: 'not in the source' } } } },
    { name: 'write-2', run: { fields: { 'far.max': { value: 7, page: 1, quote: '๗' } } } },
  ]
  const markdown = renderResults(score({ fields: FIELDS, truth: TRUTH, pack, compileErrors: [], runs, sources }))

  it('has the method table, the per-source breakdown, the disagreements and the limits', () => {
    for (const heading of ['## Methods', '## Agreement', '## By source', '## Disagreements', '## Limits']) expect(markdown).toContain(heading)
    expect(markdown).toContain('| point |')
    expect(markdown).toContain('| src-a |')
  })

  it('lists every disagreement with the point value, the write values and the truth', () => {
    expect(markdown).toContain(`| far.max | src-a | ${pack.far.max.value} | 6 | 7 | 7 |`)
  })

  it('lists the ungrounded write answers', () => {
    expect(markdown).toContain('write-1: far.max')
  })
})
