import type { Design } from '@/designs'
import type { Solution } from '@/solve'
import { formatQuantity } from '@/text/format'
import { t } from '@/text/messages'
import { cn } from '@/ui/cn'
import type { AreaUnit } from '@/units/area'

export type CapFigures = {
  readonly capSqm: number
  readonly reached: boolean
  readonly highRiseCostSqm: number | null
}

export const capFigures = (design: Design, { farCap }: Solution, highRiseCostSqm: number | null): CapFigures => ({
  capSqm: farCap.maxGfaSqm,
  reached: design.limitedBy === 'far',
  highRiseCostSqm,
})

export function capSentences({ capSqm, reached, highRiseCostSqm }: CapFigures, unit: AreaUnit) {
  return {
    cap: t(reached ? 'cap.reached' : 'cap.legal', { area: formatQuantity(capSqm, unit) }),
    cost: highRiseCostSqm === null ? null : t('cap.high-rise-cost', { area: formatQuantity(highRiseCostSqm, unit) }),
  }
}

export function CapLine({ figures, unit, className }: { figures: CapFigures; unit: AreaUnit; className?: string }) {
  const { cap, cost } = capSentences(figures, unit)
  return (
    <p className={cn('text-sm leading-snug', className)}>
      <span className="text-muted-foreground">{cap}</span>
      {cost && <span className="font-medium"> {cost}</span>}
    </p>
  )
}
