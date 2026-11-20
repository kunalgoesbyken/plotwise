'use client'

import { useFeasibility } from '@/feasibility/feasibility-provider'
import { t } from '@/text/messages'
import { rangeText } from './figures'
import { useFinance } from './use-finance'

export function LandLine() {
  const { design } = useFeasibility()
  const finance = useFinance()
  if (!design || !finance) return null
  const range = rangeText(finance.estimateFor(design).landValue, finance.region.currency)
  return <p className="text-xs leading-snug text-muted-foreground">{t('summary.land', { range })}</p>
}
