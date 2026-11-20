import { z } from 'zod'
import type { LngLat } from '@/geo/projection'
import { LngLatSchema } from '@/plot/plot'
import type { Georef, Question } from './types'
import { isLengthUnit, METRES_PER_UNIT } from './units'
import { UtmZoneSchema, type UtmZone } from './utm'

export const LOCATE_METHODS = ['utm', 'reference'] as const

export type FrameForm = {
  order: string
  unit: string
  locate: string
  zone: string
  hemisphere: string
  refLng: string
  refLat: string
}

const BLANK_FORM: FrameForm = { order: '', unit: '', locate: '', zone: '', hemisphere: '', refLng: '', refLat: '' }

const NumberText = z.string().trim().min(1).pipe(z.coerce.number())

const UtmFieldsSchema = z.object({ zone: NumberText, hemisphere: z.string() }).pipe(UtmZoneSchema)

const ReferenceFieldsSchema = z
  .object({ refLng: NumberText, refLat: NumberText })
  .transform(({ refLng, refLat }): [number, number] => [refLng, refLat])
  .pipe(LngLatSchema)

export function initialForm(question: Question): FrameForm {
  return question.kind === 'drawing' && question.unit ? { ...BLANK_FORM, unit: question.unit } : BLANK_FORM
}

function chosen<T extends string>(orders: readonly T[], answer: string): T | null {
  return orders.length === 1 ? orders[0] : (orders.find((order) => order === answer) ?? null)
}

function utmOf(form: FrameForm): UtmZone | null {
  const parsed = UtmFieldsSchema.safeParse(form)
  return parsed.success ? parsed.data : null
}

function referenceOf(form: FrameForm): LngLat | null {
  const parsed = ReferenceFieldsSchema.safeParse(form)
  return parsed.success ? parsed.data : null
}

function drawingGeoref(form: FrameForm): Georef | null {
  if (!isLengthUnit(form.unit)) return null
  const unitM = METRES_PER_UNIT[form.unit]
  if (form.locate === 'utm') {
    const utm = utmOf(form)
    return utm && { kind: 'utm', order: 'east-north', unitM, ...utm }
  }
  const at = form.locate === 'reference' ? referenceOf(form) : null
  return at && { kind: 'reference', at, unitM }
}

export function georefFor(question: Question, form: FrameForm): Georef | null {
  switch (question.kind) {
    case 'fixed':
      return { kind: 'degrees', order: 'lng-lat' }
    case 'degrees': {
      const order = chosen(question.orders, form.order)
      return order && { kind: 'degrees', order }
    }
    case 'utm': {
      const order = chosen(question.orders, form.order)
      const utm = utmOf(form)
      return order && utm && { kind: 'utm', order, unitM: 1, ...utm }
    }
    case 'drawing':
      return drawingGeoref(form)
  }
}
