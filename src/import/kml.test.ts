import { describe, expect, it } from 'bun:test'
import { KML_NO_POLYGON, KML_ONE_POLYGON, KML_OPEN_RING, KML_TWO_POLYGONS, PLOT_LNG_LAT } from './fixtures'
import { parseKml } from './kml'

function shapesOf(text: string) {
  const result = parseKml(text)
  if (!result.ok) throw new Error(`rejected: ${result.problem.reason}`)
  expect(result.value.question).toEqual({ kind: 'fixed' })
  return result.value.shapes
}

function reasonOf(text: string) {
  const result = parseKml(text)
  return result.ok ? null : result.problem.reason
}

describe('parseKml', () => {
  it('reads the outer ring of a Google Earth polygon and drops the closing corner and any hole', () => {
    expect(shapesOf(KML_ONE_POLYGON)).toEqual([{ name: 'Sukhumvit plot', points: PLOT_LNG_LAT, closed: true, curved: false }])
  })

  it('lists every polygon with its placemark name, skipping other geometry', () => {
    const shapes = shapesOf(KML_TWO_POLYGONS)
    expect(shapes.map((s) => s.name)).toEqual(['แปลงที่ 1', 'Plot B'])
    expect(shapes[1].points).toHaveLength(4)
  })

  it('finds polygons inside a MultiGeometry', () => {
    const text = `<kml><Placemark><name>Both</name><MultiGeometry>
      <Polygon><outerBoundaryIs><LinearRing><coordinates>0,0 1,0 1,1 0,0</coordinates></LinearRing></outerBoundaryIs></Polygon>
      <Polygon><outerBoundaryIs><LinearRing><coordinates>5,5 6,5 6,6 5,5</coordinates></LinearRing></outerBoundaryIs></Polygon>
    </MultiGeometry></Placemark></kml>`
    expect(shapesOf(text).map((s) => s.name)).toEqual(['Both', 'Both'])
  })

  it('marks a ring that does not end where it starts as open', () => {
    expect(shapesOf(KML_OPEN_RING)[0].closed).toBe(false)
  })

  it('says when there is no polygon', () => {
    expect(reasonOf(KML_NO_POLYGON)).toBe('no-polygon')
  })

  it('refuses a coordinate with an empty or non-numeric component instead of reading it as zero', () => {
    const polygon = (coordinates: string) =>
      `<kml><Polygon><outerBoundaryIs><LinearRing><coordinates>${coordinates}</coordinates></LinearRing></outerBoundaryIs></Polygon></kml>`
    for (const bad of ['100.5,,13.7 100.6,13.7 100.6,13.8', '100.5,13.7,0 100.6,13.7,x 100.6,13.8,0', '100.5, 13.7, 0 100.6, 13.7, 0 100.6, 13.8, 0', ',13.7 100.6,13.7 100.6,13.8', '100.5,13.7,0,1 100.6,13.7 100.6,13.8']) {
      expect(reasonOf(polygon(bad))).toBe('kml-invalid')
    }
    expect(shapesOf(polygon('100.5,13.7 100.6,13.7,0 100.6,13.8,12.5 100.5,13.7'))[0].points).toHaveLength(3)
  })

  it('refuses a file that is not well-formed XML or not KML coordinates', () => {
    expect(reasonOf('not xml')).toBe('kml-invalid')
    expect(reasonOf(KML_ONE_POLYGON.replace('</Folder>', ''))).toBe('kml-invalid')
    expect(reasonOf('<kml><Polygon><outerBoundaryIs><LinearRing><coordinates>1,2 x,y 3,4</coordinates></LinearRing></outerBoundaryIs></Polygon></kml>')).toBe('kml-invalid')
    expect(reasonOf('<kml><Polygon><outerBoundaryIs><LinearRing><coordinates>1 2 3</coordinates></LinearRing></outerBoundaryIs></Polygon></kml>')).toBe('kml-invalid')
    expect(reasonOf('<kml><Polygon></Polygon></kml>')).toBe('kml-invalid')
  })
})
