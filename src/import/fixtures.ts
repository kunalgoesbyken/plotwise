import type { Pair } from './types'

export const PLOT_LNG_LAT: readonly Pair[] = [
  [100.575355, 13.77867],
  [100.57568, 13.778661],
  [100.575694, 13.779116],
  [100.575382, 13.779044],
]

export const PLOT_UTM_47N: readonly Pair[] = [
  [670_304.52, 1_523_806.26],
  [670_339.67, 1_523_805.49],
  [670_340.85, 1_523_855.84],
  [670_307.17, 1_523_847.65],
]

export const PLOT_LOCAL_MM: readonly Pair[] = [
  [0, 0],
  [35_150, -770],
  [36_330, 49_580],
  [2_650, 41_390],
]

const SECOND_LNG_LAT: readonly Pair[] = [
  [100.5771, 13.7791],
  [100.5775, 13.7791],
  [100.5775, 13.7795],
  [100.5771, 13.7795],
]

const closedTuples = (ring: readonly Pair[]) => [...ring, ring[0]].map(([lng, lat]) => `${lng},${lat},0`).join(' ')

const placemark = (name: string, ring: readonly Pair[]) => `
    <Placemark>
      <name>${name}</name>
      <Polygon>
        <extrude>1</extrude>
        <altitudeMode>clampToGround</altitudeMode>
        <outerBoundaryIs><LinearRing><coordinates>
          ${closedTuples(ring)}
        </coordinates></LinearRing></outerBoundaryIs>
        <innerBoundaryIs><LinearRing><coordinates>
          100.57545,13.77880,0 100.57550,13.77880,0 100.57550,13.77885,0 100.57545,13.77885,0 100.57545,13.77880,0
        </coordinates></LinearRing></innerBoundaryIs>
      </Polygon>
    </Placemark>`

const kml = (body: string) => `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">
  <Document>
    <name>Survey</name>
    <Folder>${body}
    </Folder>
  </Document>
</kml>`

export const KML_ONE_POLYGON = kml(placemark('Sukhumvit plot', PLOT_LNG_LAT))

export const KML_TWO_POLYGONS = kml(`${placemark('แปลงที่ 1', PLOT_LNG_LAT)}
    <Placemark><name>Gate</name><Point><coordinates>100.5754,13.7788,0</coordinates></Point></Placemark>${placemark('Plot B', SECOND_LNG_LAT)}`)

export const KML_OPEN_RING = kml(`
    <Placemark><name>Open</name><Polygon><outerBoundaryIs><LinearRing><coordinates>
      ${PLOT_LNG_LAT.map(([lng, lat]) => `${lng},${lat},0`).join(' ')}
    </coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`)

export const KML_NO_POLYGON = kml('<Placemark><name>Gate</name><Point><coordinates>100.5754,13.7788,0</coordinates></Point></Placemark>')

const ring = (points: readonly Pair[]) => [...points, points[0]]

export const GEOJSON_ONE_POLYGON = JSON.stringify({
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { name: 'Sukhumvit plot' }, geometry: { type: 'Polygon', coordinates: [ring(PLOT_LNG_LAT)] } },
    { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [100.5754, 13.7788] } },
  ],
})

export const GEOJSON_MULTI_POLYGON = JSON.stringify({
  type: 'Feature',
  properties: { name: 'Two parcels' },
  geometry: { type: 'MultiPolygon', coordinates: [[ring(PLOT_LNG_LAT)], [ring(SECOND_LNG_LAT)]] },
})

export const GEOJSON_BARE_POLYGON = JSON.stringify({ type: 'Polygon', coordinates: [ring(PLOT_LNG_LAT).map(([lng, lat]) => [lng, lat, 3.2])] })

export const GEOJSON_OPEN_RING = JSON.stringify({ type: 'Polygon', coordinates: [PLOT_LNG_LAT] })

export const GEOJSON_NO_POLYGON = JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: null, geometry: null }] })

type Group = readonly [code: number, value: string | number]

const lines = (groups: readonly Group[]) => groups.map(([code, value]) => `${String(code).padStart(3)}\n${value}`).join('\n')

const section = (name: string, groups: readonly Group[]): Group[] => [[0, 'SECTION'], [2, name], ...groups, [0, 'ENDSEC']]

const header = (units: number | null): Group[] =>
  section('HEADER', [[9, '$ACADVER'], [1, 'AC1015'], ...(units === null ? [] : [[9, '$INSUNITS'] as Group, [70, units] as Group])])

export function lwpolyline(layer: string, points: readonly Pair[], flags: number, bulge = 0): Group[] {
  return [
    [0, 'LWPOLYLINE'],
    [5, '2A'],
    [100, 'AcDbEntity'],
    [8, layer],
    [100, 'AcDbPolyline'],
    [90, points.length],
    [70, flags],
    ...points.flatMap(([x, y]): Group[] => [[10, x], [20, y], ...(bulge === 0 ? [] : [[42, bulge] as Group])]),
  ]
}

function oldPolyline(layer: string, points: readonly Pair[], flags: number): Group[] {
  return [
    [0, 'POLYLINE'],
    [8, layer],
    [66, 1],
    [70, flags],
    ...points.flatMap(([x, y]): Group[] => [[0, 'VERTEX'], [8, layer], [10, x], [20, y], [30, 0]]),
    [0, 'SEQEND'],
    [8, layer],
  ]
}

export function dxfFile(units: number | null, entities: readonly Group[]): string {
  const blocks = section('BLOCKS', [[0, 'BLOCK'], [8, '0'], [2, 'SYMBOL'], ...lwpolyline('0', PLOT_LOCAL_MM, 1), [0, 'ENDBLK']])
  return `${lines([...header(units), ...blocks, ...section('ENTITIES', entities), [0, 'EOF']])}\n`
}

const CLOSED_FLAG = 1

export const DXF_UTM = dxfFile(6, [
  ...lwpolyline('ROAD', [[670_290, 1_523_790], [670_360, 1_523_790]], 0),
  ...lwpolyline('PLOT', PLOT_UTM_47N, CLOSED_FLAG),
  ...oldPolyline('BUILDING', [[670_310, 1_523_810], [670_320, 1_523_810], [670_320, 1_523_820], [670_310, 1_523_820]], CLOSED_FLAG),
])

export const DXF_MM = dxfFile(4, lwpolyline('LOT', PLOT_LOCAL_MM, CLOSED_FLAG))

export const DXF_NO_UNITS = dxfFile(null, lwpolyline('LOT', PLOT_LOCAL_MM, CLOSED_FLAG))

export const DXF_REPEATED_START = dxfFile(6, lwpolyline('LOT', ring(PLOT_UTM_47N), 0))

export const DXF_OPEN = dxfFile(6, lwpolyline('LOT', PLOT_UTM_47N, 0))

export const DXF_CURVED = dxfFile(6, lwpolyline('LOT', PLOT_UTM_47N, CLOSED_FLAG, 0.4))

export const DXF_NO_POLYLINE = dxfFile(6, [[0, 'LINE'], [8, 'ROAD'], [10, 0], [20, 0], [11, 10], [21, 10]])

export const DXF_BINARY = 'AutoCAD Binary DXF\r\n\x1a\x00'
