import { z } from 'zod'
import { shapeOf } from './shape'
import { fail, succeed, type Pair, type Result, type Shape, type Source } from './types'

const PositionSchema = z.tuple([z.number(), z.number()], z.number())
const PolygonCoordinates = z.array(z.array(PositionSchema)).min(1)

const PolygonSchema = z.object({ type: z.literal('Polygon'), coordinates: PolygonCoordinates })
const MultiPolygonSchema = z.object({ type: z.literal('MultiPolygon'), coordinates: z.array(PolygonCoordinates) })

const GeometrySchema = z.discriminatedUnion('type', [PolygonSchema, MultiPolygonSchema])

const NodeSchema = z.object({
  type: z.string(),
  geometry: z.unknown().optional(),
  features: z.array(z.unknown()).optional(),
  geometries: z.array(z.unknown()).optional(),
  properties: z.object({ name: z.unknown().optional() }).nullish(),
})

type Outer = z.infer<typeof PolygonCoordinates>[number]

const shapeFrom = (name: string | null, outer: Outer) => shapeOf(name, outer.map(([lng, lat]): Pair => [lng, lat]), false)

function shapesIn(value: unknown, inherited: string | null): Result<Shape[]> {
  const node = NodeSchema.safeParse(value)
  if (!node.success) return succeed([])
  const { type, geometry, features, geometries, properties } = node.data
  const featureName = typeof properties?.name === 'string' && properties.name.trim() !== '' ? properties.name.trim() : inherited
  if (type === 'Polygon' || type === 'MultiPolygon') {
    const polygons = GeometrySchema.safeParse(value)
    if (!polygons.success) return fail('geojson-invalid')
    const rings = polygons.data.type === 'Polygon' ? [polygons.data.coordinates] : polygons.data.coordinates
    return succeed(rings.map(([outer]) => shapeFrom(inherited, outer)))
  }
  const children = type === 'Feature' ? [geometry] : (features ?? geometries ?? [])
  const nested = children.map((child) => shapesIn(child, featureName))
  const failed = nested.find((result) => !result.ok)
  return failed ?? succeed(nested.flatMap((result) => (result.ok ? result.value : [])))
}

export function parseGeoJson(text: string): Result<Source> {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return fail('geojson-invalid')
  }
  const shapes = shapesIn(value, null)
  if (!shapes.ok) return shapes
  if (shapes.value.length === 0) return fail('no-polygon')
  return succeed({ shapes: shapes.value, question: { kind: 'fixed' } })
}
