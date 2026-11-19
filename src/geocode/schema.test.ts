import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import { MAX_QUERY_LENGTH, MIN_QUERY_LENGTH, PlaceQuerySchema, normaliseQuery } from './schema'

function issues(param: unknown): string {
  const result = PlaceQuerySchema.safeParse(param)
  return result.success ? '' : result.error.issues.map((issue) => issue.message).join(' | ')
}

describe('PlaceQuerySchema', () => {
  it('accepts English and Thai text and normalises spacing and case', () => {
    expect(PlaceQuerySchema.parse('  Ratchadaphisek   Road ')).toBe('ratchadaphisek road')
    expect(PlaceQuerySchema.parse('ถนน รัชดาภิเษก')).toBe('ถนน รัชดาภิเษก')
    expect(PlaceQuerySchema.parse('สุขุมวิท 21')).toBe('สุขุมวิท 21')
  })

  it('orders a Thai below-vowel and tone mark the same way however they were typed', () => {
    const toneFirst = String.fromCodePoint(0x0e01, 0x0e48, 0x0e38, 0x0e07)
    const vowelFirst = String.fromCodePoint(0x0e01, 0x0e38, 0x0e48, 0x0e07)
    expect(normaliseQuery(toneFirst)).toBe(normaliseQuery(vowelFirst))
  })

  it.each([
    [null, 'q is required'],
    ['', `at least ${MIN_QUERY_LENGTH}`],
    ['  a  ', `at least ${MIN_QUERY_LENGTH}`],
    ['x'.repeat(MAX_QUERY_LENGTH + 1), `at most ${MAX_QUERY_LENGTH}`],
    ['?!-', 'letter or digit'],
  ])('rejects %p with a clear message', (param, expected) => {
    expect(issues(param)).toContain(expected)
  })

  it('is idempotent, so the client and the server agree on the cache key', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'grapheme', maxLength: 40 }), (text) => {
        expect(normaliseQuery(normaliseQuery(text))).toBe(normaliseQuery(text))
      }),
    )
  })
})
