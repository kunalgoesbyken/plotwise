import { RoadWidthSchema } from '@/plot/plot'
import { readNumber } from '@/text/read-number'

export function parseMetres(text: string): number | null {
  const read = readNumber(text)
  if (read.kind !== 'number') return null
  const parsed = RoadWidthSchema.safeParse(read.value)
  return parsed.success ? parsed.data : null
}

export const hasDecimalComma = (text: string) => {
  const read = readNumber(text)
  return read.kind === 'unreadable' && read.reason === 'comma'
}
