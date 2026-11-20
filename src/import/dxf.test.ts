import fc from 'fast-check'
import { describe, expect, it } from 'bun:test'
import { parseDxf } from './dxf'
import {
  DXF_BINARY,
  DXF_CURVED,
  DXF_MM,
  DXF_NO_POLYLINE,
  DXF_NO_UNITS,
  DXF_OPEN,
  DXF_REPEATED_START,
  DXF_UTM,
  dxfFile,
  lwpolyline,
  PLOT_LOCAL_MM,
  PLOT_UTM_47N,
} from './fixtures'

function sourceOf(text: string) {
  const result = parseDxf(text)
  if (!result.ok) throw new Error(`rejected: ${result.problem.reason}`)
  return result.value
}

function reasonOf(text: string) {
  const result = parseDxf(text)
  return result.ok ? null : result.problem.reason
}

describe('parseDxf', () => {
  it('lists every polyline of the drawing section with its layer, in file order', () => {
    const { shapes, question } = sourceOf(DXF_UTM)
    expect(shapes.map((s) => [s.name, s.closed, s.points.length])).toEqual([
      ['ROAD', false, 2],
      ['PLOT', true, 4],
      ['BUILDING', true, 4],
    ])
    expect(shapes[1].points).toEqual(PLOT_UTM_47N)
    expect(question).toEqual({ kind: 'drawing', unit: 'm' })
  })

  it('does not read the polylines inside block definitions', () => {
    expect(sourceOf(DXF_MM).shapes).toHaveLength(1)
  })

  it('takes the drawing unit from the header, and has none when the header names none', () => {
    expect(sourceOf(DXF_MM).question).toEqual({ kind: 'drawing', unit: 'mm' })
    expect(sourceOf(DXF_MM).shapes[0].points).toEqual(PLOT_LOCAL_MM)
    expect(sourceOf(DXF_NO_UNITS).question).toEqual({ kind: 'drawing', unit: null })
  })

  it('treats a polyline whose first corner is repeated at the end as closed', () => {
    const [shape] = sourceOf(DXF_REPEATED_START).shapes
    expect(shape.closed).toBe(true)
    expect(shape.points).toEqual(PLOT_UTM_47N)
  })

  it('keeps an unclosed polyline as open so that choosing it is refused later', () => {
    expect(sourceOf(DXF_OPEN).shapes[0].closed).toBe(false)
  })

  it('reads CRLF files', () => {
    expect(sourceOf(DXF_MM.replaceAll('\n', '\r\n')).shapes).toHaveLength(1)
  })

  it('lists a curved polyline and marks it curved, so it is never dropped without a word', () => {
    const [shape] = sourceOf(DXF_CURVED).shapes
    expect(shape).toMatchObject({ name: 'LOT', closed: true, curved: true })
    expect(shape.points).toEqual(PLOT_UTM_47N)
  })

  it('lists curved and straight polylines together, each marked', () => {
    const mixed = dxfFile(6, [...lwpolyline('CURVED', PLOT_UTM_47N, 1, 0.4), ...lwpolyline('STRAIGHT', PLOT_UTM_47N, 1)])
    expect(sourceOf(mixed).shapes.map((s) => [s.name, s.curved])).toEqual([
      ['CURVED', true],
      ['STRAIGHT', false],
    ])
  })

  it('treats a curve-fit old-style polyline as curved', () => {
    const vertices = PLOT_UTM_47N.flatMap(([x, y]): [number, string | number][] => [[0, 'VERTEX'], [10, x], [20, y]])
    const fitted = dxfFile(6, [[0, 'POLYLINE'], [8, 'FIT'], [70, 3], ...vertices, [0, 'SEQEND']])
    expect(sourceOf(fitted).shapes[0].curved).toBe(true)
  })

  it('says when the drawing has no polyline', () => {
    expect(reasonOf(DXF_NO_POLYLINE)).toBe('no-polyline')
  })

  it('names a binary DXF rather than failing to read it', () => {
    expect(reasonOf(DXF_BINARY)).toBe('dxf-binary')
  })

  it('refuses text that is not a DXF', () => {
    expect(reasonOf('')).toBe('dxf-invalid')
    expect(reasonOf('hello\nworld\n')).toBe('dxf-invalid')
    expect(reasonOf('0\nSECTION\n2\nENTITIES\n0\nLWPOLYLINE\n10\nabc\n20\n1\n0\nENDSEC\n0\nEOF\n')).toBe('dxf-invalid')
  })

  it('never throws on any text', () => {
    fc.assert(fc.property(fc.string(), (text) => void parseDxf(text)))
    fc.assert(
      fc.property(fc.array(fc.tuple(fc.constantFrom(0, 2, 8, 9, 10, 20, 42, 70), fc.constantFrom('SECTION', 'ENTITIES', 'LWPOLYLINE', 'POLYLINE', 'VERTEX', 'ENDSEC', '1', '0.5', 'x')), { maxLength: 30 }), (groups) => {
        void parseDxf(groups.map(([code, value]) => `${code}\n${value}`).join('\n'))
      }),
    )
  })
})
