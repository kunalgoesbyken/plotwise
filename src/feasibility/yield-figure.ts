import type { Yield } from '@/designs'
import { formatQuantity } from '@/text/format'
import { t } from '@/text/messages'
import type { AreaUnit } from '@/units/area'

export type Figure = { readonly label: string; readonly value: string }

export function yieldFigure(output: Yield, area: AreaUnit): Figure {
  switch (output.kind) {
    case 'units':
      return { label: t('metric.units'), value: formatQuantity(output.count, 'count') }
    case 'rooms':
      return { label: t('metric.rooms'), value: formatQuantity(output.count, 'count') }
    case 'netArea':
      return { label: t('metric.net-area'), value: formatQuantity(output.sqm, area) }
  }
}
