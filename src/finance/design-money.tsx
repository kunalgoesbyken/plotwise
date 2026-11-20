'use client'

import type { ReactNode } from 'react'
import type { Design } from '@/designs'
import { useRegion } from '@/editor/plot-store'
import { useFeasibility } from '@/feasibility/feasibility-provider'
import { formatQuantity } from '@/text/format'
import { t } from '@/text/messages'
import { Badge } from '@/ui/badge'
import type { CostSplit } from './estimate'
import { firstCostRange, parkingText, rangeText } from './figures'
import { formatMoney } from './format-money'
import { useFinance } from './use-finance'

export type MoneyRow = { readonly label: string; readonly cell: (design: Design) => ReactNode }

export function useMoneyRows(): readonly MoneyRow[] {
  const finance = useFinance()
  const { areaUnit, areaTerms } = useRegion()
  const priced = finance?.priced
  if (!finance || !priced) return []
  const { currency } = finance.region
  return [
    { label: t('money.built-up'), cell: (design) => formatQuantity(priced.estimateFor(design).builtSqm, areaUnit) },
    { label: t('money.saleable', areaTerms), cell: (design) => formatQuantity(priced.estimateFor(design).saleableSqm, areaUnit) },
    { label: t('money.parking-levels'), cell: (design) => parkingText(priced.estimateFor(design).parking) },
    { label: t('money.first-cost'), cell: (design) => rangeText(firstCostRange(priced.estimateFor(design)), currency) },
    ...(finance.purchasePrices.length > 0 ? [{ label: t('money.purchase'), cell: (design: Design) => formatMoney(priced.estimateFor(design).purchaseCost, currency) }] : []),
    { label: t('money.land-value'), cell: (design) => rangeText(priced.estimateFor(design).landValue, currency) },
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
  const { areaUnit, areaTerms } = useRegion()
  if (!design || !finance?.priced) return null
  const estimate = finance.priced.estimateFor(design)
  const { currency } = finance.region
  return (
    <section aria-label={t('money.title')} className="flex flex-col gap-2">
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold">{t('money.title')}</h3>
        <Badge variant="outline">{t('money.estimated')}</Badge>
      </header>
      <dl className="divide-y">
        <Figure label={t('money.built-up')} value={formatQuantity(estimate.builtSqm, areaUnit)} />
        <Figure label={t('money.gross')} value={formatQuantity(estimate.grossSqm, areaUnit)} />
        <Figure label={t('money.saleable', areaTerms)} value={formatQuantity(estimate.saleableSqm, areaUnit)} />
        <Figure label={t('money.parking-area')} value={formatQuantity(estimate.parkingSqm, areaUnit)} />
        <Figure label={t('money.parking-levels')} value={parkingText(estimate.parking)} />
        <Figure label={t('money.class')} value={t(`money.class.${estimate.buildClass}`)} />
        {COST_PARTS.map(({ part, label }) => (
          <Figure key={part} label={label} value={rangeText({ low: estimate.firstCost.low[part], high: estimate.firstCost.high[part] }, currency)} />
        ))}
        <Figure label={t('money.first-cost')} value={<strong className="font-semibold">{rangeText(firstCostRange(estimate), currency)}</strong>} />
        {estimate.purchaseCost > 0 && <Figure label={t('money.purchase')} value={formatMoney(estimate.purchaseCost, currency)} />}
      </dl>
    </section>
  )
}
