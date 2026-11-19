import { describe, expect, it } from 'bun:test'
import { compilePointers } from './compile-pack'
import { splitPages } from './pages'

const sources = {
  plan: splitPages(
    [
      'หัวกระดาษ',
      '       (๑) มีอัตราส่วนพ้ืนท่ีอาคารรวมต่อพ้ืนที่ดินไม่เกิน ๗ : ๑ ท้ังนี้',
      ' (๒) มอี ัตราสว่ นของท่ีว่างไม่น้อยกว่าร้อยละส่จี ดุ ห้า',
      'โรงแรมที่มีจํานวนห้องพักเกิน ๘๐ ห้อง',
      'ห่างจากเขตที่ดินไม่น้อยกว่า 50',
      'เซนตเิ มตร เว้นแต่',
      'อาคารที่มีพื้นที่รวมกันตั้งแต่',
      '10,000 ตารางเมตรขึ้นไป แต่ไม่เกิน 30,000 ตารางเมตร',
      '\f(๑๑) การอยู่อาศัยประเภทอาคารอยู่อาศัยรวม',
      'ข้อ ๑๖ ที่ดินประเภท ย. ๙',
      'ห้ามใช้ประโยชน์ที่ดิน',
      '\f',
    ].join('\n'),
  ),
}

const ref = (line: number, token: string) => ({ src: 'plan', page: 1, line, token, clause: 'ข้อ 16' })

describe('compilePointers', () => {
  it('copies the value from the source token and quotes the whole line', () => {
    const result = compilePointers({ far: { $num: ref(2, '๗ : ๑') } }, sources)
    expect(result).toEqual({
      ok: true,
      value: {
        far: {
          value: 7,
          cite: {
            source: 'plan',
            clause: 'ข้อ 16',
            page: 1,
            line: 2,
            quote: '(๑) มีอัตราส่วนพ้ืนท่ีอาคารรวมต่อพ้ืนที่ดินไม่เกิน ๗ : ๑ ท้ังนี้',
          },
        },
      },
    })
  })

  it('reads Thai number words as written in the extracted text', () => {
    const result = compilePointers({ osr: { $num: ref(3, 'ร้อยละส่จี ดุ ห้า') } }, sources)
    expect(result.ok && (result.value as { osr: { value: number } }).osr.value).toBeCloseTo(0.045, 12)
  })

  it('matches a correctly spelled phrase against the garbled extraction', () => {
    const result = compilePointers({ osr: { $num: ref(3, 'ร้อยละสี่จุดห้า') } }, sources)
    expect(result.ok && (result.value as { osr: { value: number } }).osr.value).toBeCloseTo(0.045, 12)
  })

  it('turns a comparison word on the same line into a bound', () => {
    const result = compilePointers({ rooms: { $bound: { ...ref(4, '๘๐'), op: 'เกิน' } } }, sources)
    expect(result.ok && result.value).toMatchObject({ rooms: { value: 80, cmp: 'gt' } })
  })

  it('reads the comparison word from the previous line when the sentence wraps', () => {
    const result = compilePointers({ area: { $bound: { ...ref(8, '10,000 ตารางเมตร'), op: 'ตั้งแต่', opLine: 7 } } }, sources)
    expect(result.ok && result.value).toMatchObject({ area: { value: 10000, cmp: 'gte', cite: { line: 8 } } })
  })

  it('takes the comparison word that directly precedes the value, not one elsewhere on the line', () => {
    const result = compilePointers({ area: { $bound: { ...ref(8, '30,000 ตารางเมตร'), op: 'ไม่เกิน' } } }, sources)
    expect(result.ok && result.value).toMatchObject({ area: { value: 30000, cmp: 'lte' } })
  })

  it('rejects a comparison word that is only part of the real one', () => {
    const result = compilePointers({ area: { $bound: { ...ref(8, '30,000 ตารางเมตร'), op: 'เกิน' } } }, sources)
    expect(!result.ok && result.errors[0].reason).toBe('op_mismatch')
  })

  it('rejects a value with no comparison word in front of it', () => {
    const result = compilePointers({ area: { $bound: { ...ref(8, '10,000 ตารางเมตร'), op: 'ตั้งแต่' } } }, sources)
    expect(!result.ok && result.errors[0].reason).toBe('op_missing')
  })

  it('converts a unit written on the next line into metres', () => {
    const result = compilePointers({ wall: { $num: { ...ref(5, '50'), unit: 'เซนตเิ มตร', unitLine: 6 } } }, sources)
    expect(result.ok && result.value).toMatchObject({ wall: { value: 0.5, cite: { line: 5 } } })
  })

  it('rejects a unit it cannot convert', () => {
    const result = compilePointers({ wall: { $num: { ...ref(5, '50'), unit: 'เว้นแต่', unitLine: 6 } } }, sources)
    expect(!result.ok && result.errors[0].reason).toBe('unparseable')
  })

  it('emits a bare cite for text-only references', () => {
    const result = compilePointers({ hotel: { $cite: ref(4, 'โรงแรม') } }, sources)
    expect(result.ok && result.value).toMatchObject({ hotel: { page: 1, line: 4, quote: 'โรงแรมที่มีจํานวนห้องพักเกิน ๘๐ ห้อง' } })
  })

  it('copies structure that is not a reference unchanged', () => {
    const result = compilePointers({ kind: 'perUnit', list: [1, { $num: ref(4, '๘๐') }] }, sources)
    expect(result.ok && result.value).toMatchObject({ kind: 'perUnit', list: [1, { value: 80 }] })
  })

  it('collects every failing reference with its path and reason', () => {
    const result = compilePointers(
      {
        a: { $num: ref(2, '๘ : ๑') },
        b: [{ $num: ref(999, '๗') }],
        c: { $num: { ...ref(2, '๗'), src: 'nope' } },
        d: { $num: ref(4, 'โรงแรม') },
        e: { $bound: { ...ref(4, '๘๐'), op: 'ไม่น้อยกว่า' } },
      },
      sources,
    )
    expect(result.ok).toBe(false)
    expect(!result.ok && result.errors.map((e) => [e.path, e.reason])).toEqual([
      ['a', 'token_not_on_line'],
      ['b.0', 'line_missing'],
      ['c', 'source_missing'],
      ['d', 'unparseable'],
      ['e', 'op_mismatch'],
    ])
  })

  it('rejects a malformed reference instead of copying it', () => {
    const result = compilePointers({ a: { $num: { src: 'plan', page: 1 } } }, sources)
    expect(!result.ok && result.errors[0].reason).toBe('malformed')
  })
})

describe('compilePointers $absent', () => {
  const absent = (term: string, to = 3) => ({
    $absent: { src: 'plan', clause: 'ข้อ 16', from: { page: 2, line: 2 }, to: { page: 2, line: to }, term },
  })

  it('proves a term is missing from a span and cites both ends', () => {
    const result = compilePointers({ condo: absent('อาคารอยู่อาศัยรวม') }, sources)
    expect(result.ok && result.value).toMatchObject({
      condo: { term: 'อาคารอยู่อาศัยรวม', from: { page: 2, line: 2 }, to: { page: 2, line: 3 } },
    })
  })

  it('fails when the term is inside the span', () => {
    const result = compilePointers({ condo: absent('ประโยชน์ที่ดิน') }, sources)
    expect(!result.ok && result.errors[0].reason).toBe('term_present')
  })

  it('fails when the term appears nowhere in the source, so a typo cannot pass', () => {
    const result = compilePointers({ condo: absent('คอนโดมิเนียม') }, sources)
    expect(!result.ok && result.errors[0].reason).toBe('term_unknown')
  })
})
