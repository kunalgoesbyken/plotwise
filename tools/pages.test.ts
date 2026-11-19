import { describe, expect, it } from 'bun:test'
import fc from 'fast-check'
import { findLines, lineAt, rawToken, splitPages } from './pages'

describe('splitPages', () => {
  it('splits on form feed into 1-based pages of 1-based lines', () => {
    const pages = splitPages('a\nb\fc\nd\ne\f')
    expect(pages.length).toBe(2)
    expect(lineAt(pages, 1, 2)).toBe('b')
    expect(lineAt(pages, 2, 3)).toBe('e')
  })

  it('treats CRLF like LF', () => {
    expect(lineAt(splitPages('x\r\ny\r\n\fz'), 1, 2)).toBe('y')
  })

  it('returns undefined for a missing page or line', () => {
    const pages = splitPages('a\fb')
    expect(lineAt(pages, 3, 1)).toBeUndefined()
    expect(lineAt(pages, 1, 2)).toBeUndefined()
    expect(lineAt(pages, 0, 1)).toBeUndefined()
  })

  it('finds lines by Thai skeleton, so garbled extractions still match', () => {
    const pages = splitPages('หัวเรื่อง\nไมน่ ้อยกวา่ ร้อยละส่จี ดุ ห้า\fอื่น\nไม่น้อยกว่า ๑๒ เมตร\f')
    expect(findLines(pages, 'ไม่น้อยกว่า')).toEqual([
      { page: 1, line: 2, text: 'ไมน่ ้อยกวา่ ร้อยละส่จี ดุ ห้า' },
      { page: 2, line: 2, text: 'ไม่น้อยกว่า ๑๒ เมตร' },
    ])
    expect(findLines(pages, 'ร้อยละสี่จุดห้า').map((hit) => hit.page)).toEqual([1])
  })

  it('recovers the exact extracted spelling of a phrase on a line', () => {
    expect(rawToken('ระดับทห่ี น่ึง ให้มี', 'หนึ่ง')).toBe('ห่ี น่ึง')
    expect(rawToken('(1) อาคารอยู่อาศยั และ', 'อาคารอยู่อาศัย')).toBe('อาคารอยู่อาศยั')
    expect(rawToken('แตไ่ มเ่ กนิ 20 เมตร', 'ไม่เกิน')).toBe('ไ่ มเ่ กนิ')
    expect(rawToken('ไม่มีคำนี้', 'โรงแรม')).toBeUndefined()
  })

  it('never matches a number inside a longer number', () => {
    expect(rawToken('ไม่ถึง 23 เมตร', '3')).toBeUndefined()
    expect(rawToken('ไม่ถึง 23 เมตร', '2')).toBeUndefined()
    expect(rawToken('ไม่น้อยกว่า ๑๘ เมตร', '๘ เมตร')).toBeUndefined()
    expect(rawToken('10,000 ตารางเมตร', '0,000')).toBeUndefined()
    expect(rawToken('ไม่ถึง 23 เมตร ไม่น้อยกว่า 3', '3')).toBe('3')
  })

  it('keeps every line of every page', () => {
    const line = fc.stringMatching(/^[^\f\r\n]*$/)
    fc.assert(
      fc.property(fc.array(fc.array(line, { minLength: 1 }), { minLength: 1 }), (doc) => {
        const pages = splitPages(doc.map((p) => `${p.join('\n')}\f`).join(''))
        expect(pages.length).toBe(doc.length)
        doc.forEach((p, i) => p.forEach((l, j) => expect(lineAt(pages, i + 1, j + 1)).toBe(l)))
      }),
    )
  })
})
