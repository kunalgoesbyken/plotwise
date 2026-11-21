import type { CapFigures, Ceiling } from '@/designs'
import { formatList, formatQuantity } from '@/text/format'
import { t } from '@/text/messages'
import { cn } from '@/ui/cn'
import type { AreaUnit } from '@/units/area'

export function capSentence(figures: CapFigures, unit: AreaUnit): string {
  const area = (sqm: number) => formatQuantity(sqm, unit)
  switch (figures.kind) {
    case 'reached':
      return t('cap.reached', { area: area(figures.capSqm) })
    case 'legal':
      return t('cap.legal', { area: area(figures.capSqm) })
    case 'short':
      return t('cap.steps', {
        cap: area(figures.capSqm),
        losses: figures.losses.map((loss) => t('cap.loss', { limiter: t(`limiter.${loss.limitedBy}`), area: area(loss.sqm) })),
        buildable: area(figures.buildableSqm),
      })
  }
}

const ceilingSentence = ({ gfaSqm, purchases }: Ceiling, unit: AreaUnit) =>
  t('cap.up-to', { area: formatQuantity(gfaSqm, unit), purchases: formatList(purchases.map((kind) => t(`cap.up-to.${kind}`))) })

export function CeilingLine({ ceiling, unit, className }: { ceiling: Ceiling; unit: AreaUnit; className?: string }) {
  return <p className={cn('text-sm leading-snug font-medium', className)}>{ceilingSentence(ceiling, unit)}</p>
}

export function CapLine({ figures, unit, className }: { figures: CapFigures; unit: AreaUnit; className?: string }) {
  return (
    <p className={cn('text-sm leading-snug', figures.kind === 'short' ? 'font-medium' : 'text-muted-foreground', className)}>{capSentence(figures, unit)}</p>
  )
}
