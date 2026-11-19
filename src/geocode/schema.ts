import { z } from 'zod'

export const MIN_QUERY_LENGTH = 2
export const MAX_QUERY_LENGTH = 100

export const PLACE_KINDS = ['house', 'street', 'locality', 'district', 'city', 'county', 'state', 'country', 'other'] as const

const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u
const WHITESPACE_RUN = /\s+/g

export function normaliseQuery(text: string): string {
  return text.normalize('NFC').replace(WHITESPACE_RUN, ' ').trim().toLowerCase()
}

export const PlaceQuerySchema = z
  .string({ error: 'q is required' })
  .transform(normaliseQuery)
  .pipe(
    z
      .string()
      .min(MIN_QUERY_LENGTH, { error: `q must be at least ${MIN_QUERY_LENGTH} characters` })
      .max(MAX_QUERY_LENGTH, { error: `q must be at most ${MAX_QUERY_LENGTH} characters` })
      .regex(LETTER_OR_DIGIT, { error: 'q must contain a letter or digit' }),
  )

export const PlaceSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  labelTh: z.string().min(1).optional(),
  lngLat: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]).readonly(),
  kind: z.enum(PLACE_KINDS),
})

export const PlacesSchema = z.array(PlaceSchema)

export const PlaceErrorSchema = z.object({ error: z.string() })

export type Place = z.infer<typeof PlaceSchema>
export type PlaceKind = (typeof PLACE_KINDS)[number]
