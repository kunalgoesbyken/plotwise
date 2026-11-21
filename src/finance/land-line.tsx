'use client'

import { useFeasibility } from '@/feasibility/feasibility-provider'
import { t } from '@/text/messages'
import { AskingPrice } from './asking-price-field'
import { hasLandValue, landValueText, noLandValueText } from './figures'
import { useFinance } from './use-finance'

export function LandLine() {
  const { design } = useFeasibility()
  const finance = useFinance()
  if (!design || !finance?.priced) return null
  const estimate = finance.priced.estimateFor(design)
  const { currency } = finance.region
  const { landValue } = estimate
  return (
    <>
      <p className="text-xs leading-snug text-muted-foreground">
        {hasLandValue(landValue) ? t('summary.land', { range: landValueText(landValue, currency) }) : noLandValueText(landValue, currency)}
        {finance.priced.landCheckOf(estimate).exceeds && (
          <strong className="font-medium text-destructive"> {t('summary.land-above', { factor: finance.region.landWarningFactor.value })}</strong>
        )}
      </p>
      <AskingPrice finance={finance} design={design} />
    </>
  )
}
