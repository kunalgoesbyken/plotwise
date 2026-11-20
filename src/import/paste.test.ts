import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import { MAX_CORNERS } from '@/plot/plot'
import { ASSUMPTIONS } from '@/solve'
import { parsePasted } from './paste'
import type { Problem, Question, Shape } from './types'
import type { Bounds } from './validate'

const BANGKOK: Bounds = [97.3, 5.6, 105.7, 20.5]

const LNG_LAT = `100.575355, 13.77867
100.57568, 13.778661
100.575694, 13.779116
100.575382, 13.779044`

function parsed(text: string, bounds: Bounds = BANGKOK): { shape: Shape; question: Question } {
  const result = parsePasted(text, bounds)
  if (!result.ok) throw new Error(`rejected: ${result.problem.reason}`)
  return { shape: result.value.shapes[0], question: result.value.question }
}

function problem(text: string, bounds: Bounds = BANGKOK): Problem {
  const result = parsePasted(text, bounds)
  if (result.ok) throw new Error('accepted')
  return result.problem
}

describe('parsePasted degrees', () => {
  it('reads one corner per line and detects longitude first', () => {
    const { shape, question } = parsed(LNG_LAT)
    expect(shape.points).toHaveLength(4)
    expect(shape.points[0]).toEqual([100.575355, 13.77867])
    expect(shape.closed).toBe(true)
    expect(question).toEqual({ kind: 'degrees', orders: ['lng-lat'] })
  })

  it('detects latitude first when longitude cannot be the first value', () => {
    const { question } = parsed('13.77867 100.575355\n13.778661 100.57568\n13.779116 100.575694')
    expect(question).toEqual({ kind: 'degrees', orders: ['lat-lng'] })
  })

  it('reads corners separated by semicolons, with spaces or commas between the numbers', () => {
    const { shape } = parsed('100.5,13.7; 100.51 13.7;100.51,13.71')
    expect(shape.points).toEqual([
      [100.5, 13.7],
      [100.51, 13.7],
      [100.51, 13.71],
    ])
  })

  it('ignores an altitude, blank lines and a repeated first corner', () => {
    const { shape } = parsed('\n100.5,13.7,0\n\n100.51,13.7,2.5\r\n100.51,13.71,0\n100.5,13.7,0\n')
    expect(shape.points).toHaveLength(3)
    expect(shape.closed).toBe(true)
  })

  it('reads Thai digits', () => {
    const { shape } = parsed('๑๐๐.๕, ๑๓.๗\n๑๐๐.๕๑, ๑๓.๗\n๑๐๐.๕๑, ๑๓.๗๑')
    expect(shape.points[0]).toEqual([100.5, 13.7])
  })

  it('asks which order when both readings land inside the region', () => {
    const { question } = parsed('10.1 10.2\n10.3 10.2\n10.3 10.4', [0, 0, 50, 50])
    expect(question).toEqual({ kind: 'degrees', orders: ['lng-lat', 'lat-lng'] })
  })

  it('uses the region to settle the order when only one reading lands inside it', () => {
    const { question } = parsed('12.97 77.59\n12.98 77.59\n12.98 77.6', [77, 12, 78, 13.5])
    expect(question).toEqual({ kind: 'degrees', orders: ['lat-lng'] })
  })

  it('says so when the coordinates are valid but outside the region', () => {
    expect(problem('77.59 12.97\n77.6 12.97\n77.6 12.98')).toEqual({ reason: 'outside-region' })
  })

  it('says so when a value cannot be a coordinate on Earth', () => {
    expect(problem('100.5 95\n100.6 95.1\n100.6 95.2')).toEqual({ reason: 'out-of-range' })
  })
})

describe('parsePasted UTM', () => {
  it('detects metres east then north', () => {
    const { shape, question } = parsed('670304.52 1523806.26\n670339.67 1523805.49\n670340.85 1523855.84')
    expect(shape.points[0]).toEqual([670_304.52, 1_523_806.26])
    expect(question).toEqual({ kind: 'utm', orders: ['east-north'] })
  })

  it('detects northing first', () => {
    const { question } = parsed('1523806.26,670304.52\n1523805.49,670339.67\n1523855.84,670340.85')
    expect(question).toEqual({ kind: 'utm', orders: ['north-east'] })
  })

  it('asks which order when both values could be an easting', () => {
    const { question } = parsed('500000 600000\n500100 600000\n500100 600100')
    expect(question).toEqual({ kind: 'utm', orders: ['east-north', 'north-east'] })
  })

  it('refuses values that fit no easting', () => {
    expect(problem('1523806 1523806\n1523810 1523806\n1523810 1523810')).toEqual({ reason: 'unrecognised-coordinates' })
  })
})

describe('parsePasted failures', () => {
  it('names the entry that is not a pair of numbers', () => {
    expect(problem('100.5, 13.7\n100.6, abc\n100.6, 13.8')).toEqual({ reason: 'bad-entry', entry: 2 })
    expect(problem('100.5, 13.7\n100.6\n100.6, 13.8')).toEqual({ reason: 'bad-entry', entry: 2 })
    expect(problem('100.5, 13.7, 1, 2')).toEqual({ reason: 'bad-entry', entry: 1 })
    expect(problem('100.5 13.7; 100.6 13.7; Infinity 13.8')).toEqual({ reason: 'bad-entry', entry: 3 })
  })

  it('refuses text with no corners', () => {
    expect(problem('')).toEqual({ reason: 'too-few-corners' })
    expect(problem(' \n ; \n')).toEqual({ reason: 'too-few-corners' })
  })

  it('refuses degrees mixed with metres', () => {
    expect(problem('100.5 13.7\n670304 1523806\n100.6 13.8')).toEqual({ reason: 'unrecognised-coordinates' })
  })

  it('reads back any corners written out one per line, in either order', () => {
    const corner = fc.tuple(fc.double({ min: 98, max: 105, noNaN: true }), fc.double({ min: 6, max: 20, noNaN: true }))
    fc.assert(
      fc.property(fc.array(corner, { minLength: 3, maxLength: 20 }), fc.boolean(), (corners, swap) => {
        const text = corners.map(([lng, lat]) => (swap ? `${lat}, ${lng}` : `${lng}, ${lat}`)).join('\n')
        const { shape, question } = parsed(text)
        expect(shape.points).toEqual(corners.map(([lng, lat]) => (swap ? [lat, lng] : [lng, lat])))
        expect(question).toEqual({ kind: 'degrees', orders: [swap ? 'lat-lng' : 'lng-lat'] })
      }),
    )
  })

  it('refuses more text than a plot needs before reading any of it', () => {
    const { value: limit } = ASSUMPTIONS.importMaxPasteChars
    expect(problem(`${'1'.repeat(limit)}, 2`)).toEqual({ reason: 'paste-too-large' })
  })

  it('refuses more corners than a plot can have before reading any number', () => {
    const entries = Array.from({ length: MAX_CORNERS + 2 }, () => 'not a number').join('\n')
    expect(problem(entries)).toEqual({ reason: 'too-many-corners' })
    const closed = Array.from({ length: MAX_CORNERS + 1 }, (_, i) => `${100.5 + i * 1e-4}, 13.7`).join('\n')
    expect(parsePasted(closed, BANGKOK).ok).toBe(true)
  })

  it('never throws on any text', () => {
    fc.assert(fc.property(fc.string(), (text) => void parsePasted(text, BANGKOK)))
  })
})
