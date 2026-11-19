import { z } from 'zod'

const PointSchema = z.object({ lat: z.number(), lon: z.number() })
const TagsSchema = z.record(z.string(), z.string()).default({})
const GeometrySchema = z.array(PointSchema.nullable()).optional()

const NodeSchema = z.object({ type: z.literal('node'), id: z.number() })

const WaySchema = z.object({
  type: z.literal('way'),
  id: z.number(),
  tags: TagsSchema,
  geometry: GeometrySchema,
})

const MemberSchema = z.object({
  type: z.enum(['node', 'way', 'relation']),
  ref: z.number(),
  role: z.string(),
  geometry: GeometrySchema,
})

const RelationSchema = z.object({
  type: z.literal('relation'),
  id: z.number(),
  tags: TagsSchema,
  members: z.array(MemberSchema).default([]),
})

export const OverpassResponseSchema = z.object({
  remark: z.string().optional(),
  elements: z.array(z.discriminatedUnion('type', [NodeSchema, WaySchema, RelationSchema])),
})

export type OverpassResponse = z.infer<typeof OverpassResponseSchema>
export type OverpassWay = z.infer<typeof WaySchema>
export type OverpassRelation = z.infer<typeof RelationSchema>
export type OverpassTags = OverpassWay['tags']
