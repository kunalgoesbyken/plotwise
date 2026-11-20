import { shapeOf } from './shape'
import { fail, succeed, type Result, type Shape, type Source } from './types'
import { UNIT_BY_INSUNITS, type LengthUnit } from './units'

type Group = { code: number; value: string }
type Entity = { type: string; groups: Group[] }
type Vertex = { x: number; y: number; bulge: number }
type Polyline = { layer: string; flags: number; vertices: Vertex[] }

const BINARY_SIGNATURE = 'AutoCAD Binary DXF'
const CLOSED_FLAG = 1
const CURVE_FIT_FLAGS = 2 | 4

function readGroups(text: string): Group[] | null {
  const lines = text.split(/\r?\n/)
  const groups: Group[] = []
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = Number(lines[i])
    if (lines[i].trim() === '' || !Number.isInteger(code)) return null
    groups.push({ code, value: lines[i + 1].trim() })
  }
  return groups
}

function readEntities(groups: readonly Group[]): Entity[] {
  const entities: Entity[] = []
  for (const group of groups) {
    if (group.code === 0) entities.push({ type: group.value, groups: [] })
    else entities[entities.length - 1]?.groups.push(group)
  }
  return entities
}

const valueOf = (groups: readonly Group[], code: number) => groups.find((g) => g.code === code)?.value

const numberOf = (groups: readonly Group[], code: number) => Number(valueOf(groups, code) ?? 0)

function drawingUnit(header: readonly Group[]): LengthUnit | null {
  const index = header.findIndex((g) => g.code === 9 && g.value === '$INSUNITS')
  const code = header[index + 1]?.code === 70 ? Number(header[index + 1].value) : 0
  return UNIT_BY_INSUNITS[code] ?? null
}

function lightweightVertices(groups: readonly Group[]): Vertex[] {
  const vertices: Vertex[] = []
  for (const { code, value } of groups) {
    if (code === 10) vertices.push({ x: Number(value), y: Number.NaN, bulge: 0 })
    else if (code === 20 && vertices.length > 0) vertices[vertices.length - 1].y = Number(value)
    else if (code === 42 && vertices.length > 0) vertices[vertices.length - 1].bulge = Number(value)
  }
  return vertices
}

const vertexOf = (groups: readonly Group[]): Vertex => ({ x: numberOf(groups, 10), y: numberOf(groups, 20), bulge: numberOf(groups, 42) })

function readPolylines(entities: readonly Entity[]): Polyline[] {
  const polylines: Polyline[] = []
  let open: Polyline | null = null
  for (const { type, groups } of entities) {
    const header = { layer: valueOf(groups, 8) ?? '0', flags: numberOf(groups, 70) }
    if (type === 'LWPOLYLINE') polylines.push({ ...header, vertices: lightweightVertices(groups) })
    else if (type === 'POLYLINE') polylines.push((open = { ...header, vertices: [] }))
    else if (type === 'VERTEX') open?.vertices.push(vertexOf(groups))
    else if (type === 'SEQEND') open = null
  }
  return polylines
}

const isFinitePolyline = ({ vertices }: Polyline) => vertices.every(({ x, y, bulge }) => Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(bulge))

const isCurved = ({ flags, vertices }: Polyline) => (flags & CURVE_FIT_FLAGS) !== 0 || vertices.some(({ bulge }) => bulge !== 0)

const toShape = (polyline: Polyline): Shape => {
  const { layer, flags, vertices } = polyline
  return { ...shapeOf(layer, vertices.map(({ x, y }) => [x, y] as const), (flags & CLOSED_FLAG) !== 0), curved: isCurved(polyline) }
}

function sectionsOf(entityList: readonly Entity[]) {
  const header: Group[] = []
  const entities: Entity[] = []
  let section: string | undefined
  let hasEntities = false
  for (const record of entityList) {
    if (record.type === 'SECTION') {
      section = valueOf(record.groups, 2)
      hasEntities ||= section === 'ENTITIES'
      if (section === 'HEADER') header.push(...record.groups)
    } else if (record.type === 'ENDSEC') section = undefined
    else if (section === 'ENTITIES') entities.push(record)
  }
  return { header, entities, hasEntities }
}

export function parseDxf(text: string): Result<Source> {
  if (text.startsWith(BINARY_SIGNATURE)) return fail('dxf-binary')
  const groups = readGroups(text)
  if (!groups) return fail('dxf-invalid')
  const { header, entities, hasEntities } = sectionsOf(readEntities(groups))
  if (!hasEntities) return fail('dxf-invalid')
  const polylines = readPolylines(entities).filter(({ vertices }) => vertices.length > 0)
  if (!polylines.every(isFinitePolyline)) return fail('dxf-invalid')
  if (polylines.length === 0) return fail('no-polyline')
  return succeed({ shapes: polylines.map(toShape), question: { kind: 'drawing', unit: drawingUnit(header) } })
}
