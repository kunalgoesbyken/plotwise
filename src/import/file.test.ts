import { describe, expect, it } from 'bun:test'
import { ASSUMPTIONS } from '@/solve'
import { readImportFile } from './file'
import { DXF_MM, dxfFile, GEOJSON_ONE_POLYGON, KML_ONE_POLYGON, lwpolyline, PLOT_UTM_47N } from './fixtures'

const file = (name: string, text: string) => new File([text], name)

async function reasonOf(upload: File) {
  const result = await readImportFile(upload)
  return result.ok ? null : result.problem.reason
}

describe('readImportFile', () => {
  it('reads each supported format by its extension, whatever the case', async () => {
    for (const [name, text] of [
      ['plot.kml', KML_ONE_POLYGON],
      ['PLOT.KML', KML_ONE_POLYGON],
      ['plot.geojson', GEOJSON_ONE_POLYGON],
      ['plot.json', GEOJSON_ONE_POLYGON],
      ['survey.dxf', DXF_MM],
      ['แปลง สุขุมวิท.dxf', DXF_MM],
    ] as const) {
      const result = await readImportFile(file(name, text))
      expect(result.ok).toBe(true)
    }
  })

  it('refuses a file type it cannot read', async () => {
    expect(await reasonOf(file('plot.dwg', DXF_MM))).toBe('file-unsupported')
    expect(await reasonOf(file('plot.kmz', KML_ONE_POLYGON))).toBe('file-unsupported')
    expect(await reasonOf(file('dxf', DXF_MM))).toBe('file-unsupported')
    expect(await reasonOf(file('', DXF_MM))).toBe('file-unsupported')
    expect(await reasonOf(file('plot.constructor', DXF_MM))).toBe('file-unsupported')
  })

  it('refuses a file over the size bound without reading it', async () => {
    const big = new File([new Uint8Array(ASSUMPTIONS.importMaxFileBytes.value + 1)], 'big.dxf')
    expect(await reasonOf(big)).toBe('file-too-large')
  })

  it('refuses a file with more shapes than the picker offers, and accepts exactly that many', async () => {
    const { value: cap } = ASSUMPTIONS.importMaxShapes
    const parcels = (count: number) => dxfFile(6, Array.from({ length: count }, (_, i) => lwpolyline(`L${i}`, PLOT_UTM_47N, 1)).flat())
    expect(await reasonOf(file('site.dxf', parcels(cap + 1)))).toBe('too-many-shapes')
    expect((await readImportFile(file('site.dxf', parcels(cap)))).ok).toBe(true)
  })

  it('reports a malformed file in the format it claims to be', async () => {
    expect(await reasonOf(file('plot.kml', '<kml>'))).toBe('kml-invalid')
    expect(await reasonOf(file('plot.geojson', '{'))).toBe('geojson-invalid')
    expect(await reasonOf(file('plot.dxf', 'garbage'))).toBe('dxf-invalid')
  })

  it('does not crash on a pathologically nested file', async () => {
    const depth = 200_000
    const nested = `${'{"type":"GeometryCollection","geometries":['.repeat(depth)}${']}'.repeat(depth)}`
    expect(['geojson-invalid', 'file-unreadable']).toContain(String(await reasonOf(file('deep.geojson', nested))))
  })
})
