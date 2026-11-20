import { ASSUMPTIONS } from '@/solve'
import { parseDxf } from './dxf'
import { parseGeoJson } from './geojson'
import { parseKml } from './kml'
import { fail, type Result, type Source } from './types'

const PARSERS = new Map<string, (text: string) => Result<Source>>([
  ['kml', parseKml],
  ['geojson', parseGeoJson],
  ['json', parseGeoJson],
  ['dxf', parseDxf],
])

export const FILE_ACCEPT = [...PARSERS.keys()].map((extension) => `.${extension}`).join(',')

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase()
}

function withinShapeCap(result: Result<Source>): Result<Source> {
  return result.ok && result.value.shapes.length > ASSUMPTIONS.importMaxShapes.value ? fail('too-many-shapes') : result
}

export async function readImportFile(file: File): Promise<Result<Source>> {
  const parse = PARSERS.get(extensionOf(file.name))
  if (!parse) return fail('file-unsupported')
  if (file.size > ASSUMPTIONS.importMaxFileBytes.value) return fail('file-too-large')
  try {
    return withinShapeCap(parse(await file.text()))
  } catch {
    return fail('file-unreadable')
  }
}
