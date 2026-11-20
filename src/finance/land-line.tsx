'use client'

import { useFeasibility } from '@/feasibility/feasibility-provider'
import { t } from '@/text/messages'
import { rangeText } from './figures'
import { useFinance } from './use-finance'

export function LandLine() {
  const { design } = useFeasibility()
  const finance = useFinance()
  if (!design || !finance) return null
  const estimate = finance.estimateFor(design)
  const range = rangeText(estimate.landValue, finance.region.currency)
  return (
    <p className="text-xs leading-snug text-muted-foreground">
      {t('summary.land', { range })}
      {finance.landCheckOf(estimate).exceeds && (
        <strong className="font-medium text-destructive"> {t('summary.land-above', { factor: finance.region.landWarningFactor.value })}</strong>
      )}
    </p>
  )
}
