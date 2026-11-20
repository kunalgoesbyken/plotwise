import type { Region } from '@/region/regions'
import { t } from '@/text/messages'

const CORNERS_SHOWN = 3
const DECIMALS_SHOWN = 4

export function exampleCorners({ example }: Region): string[] {
  if (!example) return Array.from({ length: CORNERS_SHOWN }, () => t('import.paste.any-corner'))
  return example.plot.ring.slice(0, CORNERS_SHOWN).map((corner) => corner.map((degrees) => degrees.toFixed(DECIMALS_SHOWN)).join(', '))
}
