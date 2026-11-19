import { describe, expect, it } from 'bun:test'
import { groundRun, quoteInSource, valuesIn } from './grounding'
import type { Field } from './inputs'

const GARBLED = [
  'ข้อ ๑๖ อัตราส่วนของที่ว่างต่อพื้นที่อาคารรวมไม่น้อยกว่า',
  'ร้อยละสีจ่ ดุ ห้า และให้มีพ้ืนท่ีน้าํ ซมึ ผ่านได้เพือ่ ปลูกตน้ ไม้',
  'ให้ร่นแนวอาคารห่างจากเขตถนนสาธารณะอย่างน้อย ๑ ใน ๑๐ ของความกว้าง',
  'ต้องไม่เกินสองเท่าของระยะราบ    ผนังต้องห่างไม่น้อยกว่า ๕๐ เซนติเมตร',
  'เพิ่มได้ไม่เกินร้อยละ',
  'ยี่สิบ',
]

describe('quoteInSource', () => {
  it('finds a clean quote in text whose Thai marks were split by the PDF layer', () => {
    expect(quoteInSource([GARBLED], 'ร้อยละสี่จุดห้า และให้มีพื้นที่น้ำซึมผ่านได้')).toBe(true)
  })

  it('finds a quote that runs across a line break', () => {
    expect(quoteInSource([GARBLED], 'อาคารรวมไม่น้อยกว่า ร้อยละสี่จุดห้า')).toBe(true)
  })

  it('rejects a quote the source does not contain', () => {
    expect(quoteInSource([GARBLED], 'ร้อยละห้า และให้มีพื้นที่น้ำซึมผ่านได้')).toBe(false)
    expect(quoteInSource([GARBLED], '   ')).toBe(false)
  })
})

describe('valuesIn', () => {
  const values = valuesIn(GARBLED)
  const has = (expected: number) => values.some((v) => Math.abs(v - expected) < 1e-9)

  it('reads Thai number words after ร้อยละ as a share', () => expect(has(0.045)).toBe(true))
  it('reads "1 in 10" as a share', () => expect(has(0.1)).toBe(true))
  it('reads a multiple written as a word', () => expect(has(2)).toBe(true))
  it('reads Thai digits, and their hundredths for percent and centimetre values', () => {
    expect(has(50)).toBe(true)
    expect(has(0.5)).toBe(true)
  })
  it('joins a percentage split across two lines', () => expect(has(0.2)).toBe(true))
  it('does not invent numbers that are not there', () => expect(has(7)).toBe(false))
})

describe('groundRun', () => {
  const fields: Field[] = [
    { path: 'openSpaceRatio.minShareOfFloorArea', source: 'plan', clause: 'ข้อ 16', page: 1 },
    { path: 'roadSetbacks[0].bands[1].setback.share', source: 'plan', clause: 'ข้อ 41', page: 1 },
    { path: 'far.max', source: 'plan', clause: 'ข้อ 16', page: 1 },
    { path: 'blindWall.minDistanceM', source: 'plan', clause: 'ข้อ 50', page: 1 },
  ]
  const sources = { plan: [GARBLED, ['หน้าอื่น ๗']] }

  it('grounds an answer whose quote is in the source and whose value is on the cited page and in the quote', () => {
    const run = { fields: { 'openSpaceRatio.minShareOfFloorArea': { value: 4.5, page: 1, quote: 'ร้อยละสี่จุดห้า' } } }
    expect(groundRun(run, fields, sources)).toEqual({ answered: 1, quoteFound: 1, valueOnPage: 1, valueInQuote: 1, ungrounded: [] })
  })

  it('flags a quote that is not in the source', () => {
    const run = { fields: { 'roadSetbacks[0].bands[1].setback.share': { value: 0.1, page: 1, quote: 'อย่างน้อย ๑ ใน ๒๐' } } }
    expect(groundRun(run, fields, sources)).toEqual({
      answered: 1,
      quoteFound: 0,
      valueOnPage: 1,
      valueInQuote: 0,
      ungrounded: ['roadSetbacks[0].bands[1].setback.share'],
    })
  })

  it('flags a value that is not on the cited page, or a page that does not exist', () => {
    const run = {
      fields: {
        'far.max': { value: 7, page: 1, quote: 'ข้อ ๑๖' },
        'blindWall.minDistanceM': { value: 0.5, page: 9, quote: 'เซนติเมตร' },
      },
    }
    expect(groundRun(run, fields, sources)).toEqual({
      answered: 2,
      quoteFound: 2,
      valueOnPage: 0,
      valueInQuote: 0,
      ungrounded: ['far.max', 'blindWall.minDistanceM'],
    })
  })

  it('counts a value that is on the page but not in the quote given for it', () => {
    const run = { fields: { 'blindWall.minDistanceM': { value: 0.5, page: 1, quote: 'ต้องไม่เกินสองเท่าของระยะราบ' } } }
    expect(groundRun(run, fields, sources)).toEqual({ answered: 1, quoteFound: 1, valueOnPage: 1, valueInQuote: 0, ungrounded: [] })
  })

  it('skips unresolved answers', () => {
    const run = { fields: { 'far.max': { value: null, page: null, quote: '' } } }
    expect(groundRun(run, fields, sources)).toEqual({ answered: 0, quoteFound: 0, valueOnPage: 0, valueInQuote: 0, ungrounded: [] })
  })

  it('cannot ground an answer without a page', () => {
    const run = { fields: { 'far.max': { value: 7, page: null, quote: 'ข้อ ๑๖' } } }
    expect(groundRun(run, fields, sources).ungrounded).toEqual(['far.max'])
  })
})
