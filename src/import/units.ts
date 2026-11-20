export const LENGTH_UNITS = ['m', 'mm', 'cm', 'ft', 'in'] as const

export type LengthUnit = (typeof LENGTH_UNITS)[number]

export const METRES_PER_UNIT: Readonly<Record<LengthUnit, number>> = {
  m: 1,
  mm: 0.001,
  cm: 0.01,
  ft: 0.3048,
  in: 0.0254,
}

export const UNIT_BY_INSUNITS: Readonly<Record<number, LengthUnit>> = {
  1: 'in',
  2: 'ft',
  4: 'mm',
  5: 'cm',
  6: 'm',
}

export const isLengthUnit = (value: string): value is LengthUnit => (LENGTH_UNITS as readonly string[]).includes(value)
