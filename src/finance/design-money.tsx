'use client'

import type { ReactNode } from 'react'
import type { Design } from '@/designs'
import { useFeasibility } from '@/feasibility/feasibility-provider'
import { formatQuantity } from '@/text/format'
import { t } from '@/text/messages'
import { Badge } from '@/ui/badge'
import type { CostSplit } from './estimate'
import { firstCostRange, parkingText, rangeText } from './figures'
import { useFinance } from './use-finance'

export type MoneyRow = { readonly label: string; readonly cell: (design: Design) => ReactNode }

export function useMoneyRows(): readonly MoneyRow[] {
  const finance = useFinance()
  if (!finance) return []
  const { currency } = finance.region
  return [
    { label: t('money.built-up'), cell: (design) => formatQuantity(finance.estimateFor(design).builtSqm, 'sqm') },
    { label: t('money.saleable'), cell: (design) => formatQuantity(finance.estimateFor(design).saleableSqm, 'sqm') },
    { label: t('money.parking-area'), cell: (design) => formatQuantity(finance.estimateFor(design).parkingSqm, 'sqm') },
    { label: t('money.parking-levels'), cell: (design) => parkingText(finance.estimateFor(design).parking) },
    { label: t('money.first-cost'), cell: (design) => rangeText(firstCostRange(finance.estimateFor(design)), currency) },
    { label: t('money.land-value'), cell: (design) => rangeText(finance.estimateFor(design).landValue, currency) },
  ]
}

const COST_PARTS: readonly { readonly part: keyof CostSplit; readonly label: string }[] = [
  { part: 'substructure', label: t('money.substructure') },
  { part: 'superstructure', label: t('money.superstructure') },
  { part: 'services', label: t('money.services') },
]

function Figure({ label, value }: { readonly label: string; readonly value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 text-sm">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  )
}

export function DesignMoney() {
  const { design } = useFeasibility()
  const finance = useFinance()
  if (!design || !finance) return null
  const estimate = finance.estimateFor(design)
  const { currency } = finance.region
  return (
    <section aria-label={t('money.title')} className="flex flex-col gap-2">
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold">{t('money.title')}</h3>
        <Badge variant="outline">{t('money.estimated')}</Badge>
      </header>
      <dl className="divide-y">
        <Figure label={t('money.built-up')} value={formatQuantity(estimate.builtSqm, 'sqm')} />
        <Figure label={t('money.gross')} value={formatQuantity(estimate.grossSqm, 'sqm')} />
        <Figure label={t('money.saleable')} value={formatQuantity(estimate.saleableSqm, 'sqm')} />
        <Figure label={t('money.parking-area')} value={formatQuantity(estimate.parkingSqm, 'sqm')} />
        <Figure label={t('money.parking-levels')} value={parkingText(estimate.parking)} />
        <Figure label={t('money.class')} value={t(`money.class.${estimate.buildClass}`)} />
        {COST_PARTS.map(({ part, label }) => (
          <Figure key={part} label={label} value={rangeText({ low: estimate.firstCost.low[part], high: estimate.firstCost.high[part] }, currency)} />
        ))}
        <Figure label={t('money.first-cost')} value={<strong className="font-semibold">{rangeText(firstCostRange(estimate), currency)}</strong>} />
      </dl>
    </section>
  )
}
