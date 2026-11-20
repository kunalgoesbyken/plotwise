import { describe, expect, it } from 'bun:test'
import {
  GEOJSON_BARE_POLYGON,
  GEOJSON_MULTI_POLYGON,
  GEOJSON_NO_POLYGON,
  GEOJSON_ONE_POLYGON,
  GEOJSON_OPEN_RING,
  PLOT_LNG_LAT,
} from './fixtures'
import { parseGeoJson } from './geojson'

function shapesOf(text: string) {
  const result = parseGeoJson(text)
  if (!result.ok) throw new Error(`rejected: ${result.problem.reason}`)
  expect(result.value.question).toEqual({ kind: 'fixed' })
  return result.value.shapes
}

function reasonOf(text: string) {
  const result = parseGeoJson(text)
  return result.ok ? null : result.problem.reason
}

describe('parseGeoJson', () => {
  it('reads the polygon of a feature collection and skips other geometry', () => {
    expect(shapesOf(GEOJSON_ONE_POLYGON)).toEqual([{ name: 'Sukhumvit plot', points: PLOT_LNG_LAT, closed: true }])
  })

  it('lists each polygon of a multipolygon under the feature name', () => {
    const shapes = shapesOf(GEOJSON_MULTI_POLYGON)
    expect(shapes.map((s) => s.name)).toEqual(['Two parcels', 'Two parcels'])
    expect(shapes[0].points).toEqual(PLOT_LNG_LAT)
  })

  it('reads a bare geometry and ignores altitude', () => {
    expect(shapesOf(GEOJSON_BARE_POLYGON)).toEqual([{ name: null, points: PLOT_LNG_LAT, closed: true }])
  })

  it('reads the polygons inside a geometry collection', () => {
    const text = JSON.stringify({
      type: 'GeometryCollection',
      geometries: [{ type: 'Point', coordinates: [1, 2] }, JSON.parse(GEOJSON_BARE_POLYGON)],
    })
    expect(shapesOf(text)).toHaveLength(1)
  })

  it('takes only the outer ring of a polygon with holes', () => {
    const outer = [[0, 0], [4, 0], [4, 4], [0, 0]]
    const hole = [[1, 1], [2, 1], [2, 2], [1, 1]]
    expect(shapesOf(JSON.stringify({ type: 'Polygon', coordinates: [outer, hole] }))[0].points).toHaveLength(3)
  })

  it('marks a ring that does not end where it starts as open', () => {
    expect(shapesOf(GEOJSON_OPEN_RING)[0].closed).toBe(false)
  })

  it('says when there is no polygon', () => {
    expect(reasonOf(GEOJSON_NO_POLYGON)).toBe('no-polygon')
    expect(reasonOf('{"type":"Point","coordinates":[1,2]}')).toBe('no-polygon')
    expect(reasonOf('[]')).toBe('no-polygon')
  })

  it('refuses text that is not JSON or has malformed coordinates', () => {
    expect(reasonOf('{not json')).toBe('geojson-invalid')
    expect(reasonOf('')).toBe('geojson-invalid')
    expect(reasonOf('{"type":"Polygon","coordinates":"x"}')).toBe('geojson-invalid')
    expect(reasonOf('{"type":"Polygon","coordinates":[[[1,"a"],[2,3],[4,5],[1,"a"]]]}')).toBe('geojson-invalid')
    expect(reasonOf('{"type":"Polygon","coordinates":[[[1],[2],[3]]]}')).toBe('geojson-invalid')
    expect(reasonOf('{"type":"Polygon","coordinates":[]}')).toBe('geojson-invalid')
  })
})
