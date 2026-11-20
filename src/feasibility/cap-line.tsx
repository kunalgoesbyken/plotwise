import type { Design } from '@/designs'
import type { Solution } from '@/solve'
import { formatQuantity } from '@/text/format'
import { t } from '@/text/messages'
import { cn } from '@/ui/cn'
import type { AreaUnit } from '@/units/area'

export type CapFigures =
  | { readonly kind: 'reached'; readonly capSqm: number }
  | { readonly kind: 'short'; readonly capSqm: number; readonly highRiseCostSqm: number | null }

export function capFigures(design: Design, { farCap }: Solution, highRiseCostSqm: number | null): CapFigures {
  const capSqm = farCap.maxGfaSqm
  return design.limitedBy === 'far' ? { kind: 'reached', capSqm } : { kind: 'short', capSqm, highRiseCostSqm }
}

export function capSentences(figures: CapFigures, unit: AreaUnit) {
  const area = formatQuantity(figures.capSqm, unit)
  if (figures.kind === 'reached') return { cap: t('cap.reached', { area }), cost: null }
  const { highRiseCostSqm } = figures
  return {
    cap: t('cap.legal', { area }),
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
