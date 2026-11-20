import { describe, expect, it } from 'bun:test'
import fc from 'fast-check'
import { comparatorSide, parseComparator, parseQuantity, thaiSkeleton, unitToMetres } from './quantity'

const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙'
const DIGIT_WORDS = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า']

const toThaiDigits = (s: string) => s.replace(/\d/g, (d) => THAI_DIGITS[Number(d)])

const intWords = (n: number): string => {
  if (n < 10) return DIGIT_WORDS[n]
  const tens = Math.floor(n / 10)
  const units = n % 10
  const tensWord = tens === 1 ? 'สิบ' : tens === 2 ? 'ยี่สิบ' : `${DIGIT_WORDS[tens]}สิบ`
  const unitsWord = units === 0 ? '' : units === 1 ? 'เอ็ด' : DIGIT_WORDS[units]
  return tensWord + unitsWord
}

const sprinkleSpaces = (s: string, seed: number[]) =>
  [...s].map((ch, i) => (seed[i % seed.length] === 0 ? `${ch} ` : ch)).join('')

describe('thaiSkeleton', () => {
  it('drops tone marks, upper and lower vowels and spaces', () => {
    expect(thaiSkeleton('ร้อยละส่จี ดุ ห้า')).toBe(thaiSkeleton('ร้อยละสี่จุดห้า'))
    expect(thaiSkeleton('ไมน่ ้อยกวา่')).toBe(thaiSkeleton('ไม่น้อยกว่า'))
    expect(thaiSkeleton('ไม่ตํ่ากวา่')).toBe(thaiSkeleton('ไม่ต่ำกว่า'))
  })
})

describe('parseQuantity', () => {
  it('reads Thai and Arabic digits with thousands separators', () => {
    expect(parseQuantity('๕๐๐')).toBe(500)
    expect(parseQuantity('๑๐,๐๐๐')).toBe(10000)
    expect(parseQuantity('12.00')).toBe(12)
  })

  it('reads a ratio as the first term over the second', () => {
    expect(parseQuantity('๗ : ๑')).toBe(7)
    expect(parseQuantity('10 ต่อ 1')).toBe(10)
  })

  it('reads "a ใน b" as a fraction', () => {
    expect(parseQuantity('1 ใน 10')).toBe(0.1)
    expect(parseQuantity('30 ใน 100')).toBe(0.3)
  })

  it('reads percentages in words or digits as fractions', () => {
    expect(parseQuantity('ร้อยละส่จี ดุ ห้า')).toBeCloseTo(0.045, 12)
    expect(parseQuantity('รอ้ ยละหา้ สบิ')).toBe(0.5)
    expect(parseQuantity('ร้อยละยี่สิบ')).toBe(0.2)
    expect(parseQuantity('ร้อยละ 30')).toBe(0.3)
  })

  it('reads ordinals', () => {
    expect(parseQuantity('ที่สี่')).toBe(4)
    expect(parseQuantity('ทห่ี น่ึง')).toBe(1)
  })

  it('reads multiples', () => {
    expect(parseQuantity('หา้ เท่า')).toBe(5)
    expect(parseQuantity('สองเท่า')).toBe(2)
    expect(parseQuantity('2 เท่า')).toBe(2)
  })

  it('ignores a trailing unit so tokens can pin the exact phrase', () => {
    expect(parseQuantity('๑๒ เมตร')).toBe(12)
    expect(parseQuantity('๑๐,๐๐๐ ตารางเมตร')).toBe(10000)
    expect(parseQuantity('๘๐ ห้อง')).toBe(80)
    expect(parseQuantity('15.00 เมตร')).toBe(15)
    expect(parseQuantity('สองชนั')).toBe(2)
    expect(parseQuantity('1 คนั')).toBe(1)
    expect(parseQuantity('๑ ลกู บาศกเ์ มตร')).toBe(1)
  })

  it('reads English percentages, number words, multiples and halves', () => {
    expect(parseQuantity('50%')).toBe(0.5)
    expect(parseQuantity('25 per cent')).toBe(0.25)
    expect(parseQuantity('one')).toBe(1)
    expect(parseQuantity('three times')).toBe(3)
    expect(parseQuantity('Two')).toBe(2)
    expect(parseQuantity('1/2')).toBe(0.5)
  })

  it('reads a share of the building height written as H over a number', () => {
    expect(parseQuantity('H/5')).toBe(0.2)
    expect(parseQuantity('H/4')).toBe(0.25)
    expect(parseQuantity('h / 4')).toBe(0.25)
  })

  it('rejects anything it cannot read', () => {
    for (const bad of ['', 'banana', '%', 'per cent', 'times', '1/', 'H/', 'H/0', 'W/5', 'eleven', 'เมตร', 'สบิ สบิ', '1 ใน', 'ร้อยละ', '๗ : ']) expect(() => parseQuantity(bad)).toThrow()
  })

  it('round-trips integers written in Thai digits', () => {
    fc.assert(fc.property(fc.nat(1_000_000), (n) => expect(parseQuantity(toThaiDigits(String(n)))).toBe(n)))
  })

  it('round-trips integers below 100 written in Thai words, whatever the spacing', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 99 }), fc.array(fc.nat(3), { minLength: 1 }), (n, seed) => {
        expect(parseQuantity(sprinkleSpaces(intWords(n), seed))).toBe(n)
      }),
    )
  })

  it('round-trips percentages with one decimal written in words', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 99 }), fc.integer({ min: 1, max: 9 }), (n, d) => {
        expect(parseQuantity(`ร้อยละ${intWords(n)}จุด${DIGIT_WORDS[d]}`)).toBeCloseTo((n + d / 10) / 100, 12)
      }),
    )
  })
})

describe('parseComparator', () => {
  it('maps Thai comparison words, including garbled extractions', () => {
    expect(parseComparator('ไมน่ ้อยกวา่')).toBe('gte')
    expect(parseComparator('ไม่ตํ่ากวา่')).toBe('gte')
    expect(parseComparator('ตงั แต่')).toBe('gte')
    expect(parseComparator('ไมเ่ กนิ')).toBe('lte')
    expect(parseComparator('เกนิ')).toBe('gt')
    expect(parseComparator('น้อยกว่า')).toBe('lt')
    expect(parseComparator('ไม่ถงึ')).toBe('lt')
    expect(parseComparator('ภายในระยะ')).toBe('lte')
    expect(parseComparator('มากกวา่')).toBe('gt')
  })

  it('maps English comparison words whatever the case, and knows which side of the value they stand', () => {
    expect(parseComparator('Less than')).toBe('lt')
    expect(parseComparator('up to')).toBe('lte')
    expect(parseComparator('not exceeding')).toBe('lte')
    expect(parseComparator('exceeding')).toBe('gt')
    expect(parseComparator('wider than')).toBe('gt')
    expect(parseComparator('& above')).toBe('gte')
    expect(parseComparator('and above')).toBe('gte')
    expect(comparatorSide('less than')).toBe('before')
    expect(comparatorSide('ไม่เกิน')).toBe('before')
    expect(comparatorSide('& above')).toBe('after')
  })

  it('rejects unknown words', () => {
    expect(() => parseComparator('ประมาณ')).toThrow()
    expect(() => parseComparator('about')).toThrow()
  })
})

describe('unitToMetres', () => {
  it('reads metres written in Thai or as m', () => {
    expect(unitToMetres('เมตร')).toBe(1)
    expect(unitToMetres('m')).toBe(1)
    expect(unitToMetres('M')).toBe(1)
    expect(() => unitToMetres('sq.m')).toThrow()
  })
})
