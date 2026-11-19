import { RoadWidthSchema } from '@/plot/plot'

export function parseMetres(text: string): number | null {
  const trimmed = text.trim().replace(',', '.')
  if (trimmed === '') return null
  const parsed = RoadWidthSchema.safeParse(Number(trimmed))
  return parsed.success ? parsed.data : null
}
