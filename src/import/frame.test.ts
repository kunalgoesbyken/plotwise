import { describe, expect, it } from 'bun:test'
import { georefFor, initialForm, type FrameForm } from './frame'
import type { Question } from './types'

const BLANK: FrameForm = { order: '', unit: '', locate: '', zone: '', hemisphere: '', refLng: '', refLat: '' }
const form = (fields: Partial<FrameForm>): FrameForm => ({ ...BLANK, ...fields })

describe('georefFor', () => {
  it('needs no answers for a file that is already in longitude and latitude', () => {
    expect(georefFor({ kind: 'fixed' }, BLANK)).toEqual({ kind: 'degrees', order: 'lng-lat' })
  })

  it('takes the only possible order without asking', () => {
    expect(georefFor({ kind: 'degrees', orders: ['lat-lng'] }, BLANK)).toEqual({ kind: 'degrees', order: 'lat-lng' })
  })

  it('waits for an answer when the order is ambiguous', () => {
    const question: Question = { kind: 'degrees', orders: ['lng-lat', 'lat-lng'] }
    expect(georefFor(question, BLANK)).toBeNull()
    expect(georefFor(question, form({ order: 'east-north' }))).toBeNull()
    expect(georefFor(question, form({ order: 'lat-lng' }))).toEqual({ kind: 'degrees', order: 'lat-lng' })
  })

  it('needs a valid UTM zone and hemisphere for pasted metres', () => {
    const question: Question = { kind: 'utm', orders: ['east-north'] }
    expect(georefFor(question, BLANK)).toBeNull()
    expect(georefFor(question, form({ zone: '47' }))).toBeNull()
    expect(georefFor(question, form({ zone: '61', hemisphere: 'N' }))).toBeNull()
    expect(georefFor(question, form({ zone: 'x', hemisphere: 'N' }))).toBeNull()
    expect(georefFor(question, form({ zone: '4.5', hemisphere: 'N' }))).toBeNull()
    expect(georefFor(question, form({ zone: ' 47 ', hemisphere: 'N' }))).toEqual({
      kind: 'utm',
      order: 'east-north',
      zone: 47,
      hemisphere: 'N',
      unitM: 1,
    })
  })

  it('needs a unit and a way to place a drawing before it can be located', () => {
    const question: Question = { kind: 'drawing', unit: null }
    expect(georefFor(question, form({ locate: 'utm', zone: '47', hemisphere: 'N' }))).toBeNull()
    expect(georefFor(question, form({ unit: 'mm' }))).toBeNull()
    expect(georefFor(question, form({ unit: 'furlong', locate: 'utm', zone: '47', hemisphere: 'N' }))).toBeNull()
  })

  it('places a drawing on a UTM zone in its own unit', () => {
    const question: Question = { kind: 'drawing', unit: 'mm' }
    expect(georefFor(question, form({ unit: 'mm', locate: 'utm', zone: '47', hemisphere: 'N' }))).toEqual({
      kind: 'utm',
      order: 'east-north',
      zone: 47,
      hemisphere: 'N',
      unitM: 0.001,
    })
  })

  it('places a drawing on a reference point', () => {
    const question: Question = { kind: 'drawing', unit: null }
    const answers = form({ unit: 'ft', locate: 'reference', refLng: '100.5', refLat: '13.7' })
    expect(georefFor(question, answers)).toEqual({ kind: 'reference', at: [100.5, 13.7], unitM: 0.3048 })
    expect(georefFor(question, { ...answers, refLat: '' })).toBeNull()
    expect(georefFor(question, { ...answers, refLat: '95' })).toBeNull()
    expect(georefFor(question, { ...answers, refLng: 'east' })).toBeNull()
  })
})

describe('initialForm', () => {
  it('starts blank, except for the unit the file declared', () => {
    expect(initialForm({ kind: 'drawing', unit: 'mm' })).toEqual({ ...BLANK, unit: 'mm' })
    expect(initialForm({ kind: 'drawing', unit: null })).toEqual(BLANK)
    expect(initialForm({ kind: 'fixed' })).toEqual(BLANK)
  })
})
