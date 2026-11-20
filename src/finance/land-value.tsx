'use client'

import { useFeasibility } from '@/feasibility/feasibility-provider'
import { t } from '@/text/messages'
import { Badge } from '@/ui/badge'
import { Disclosure } from '@/ui/disclosure'
import { rangeText } from './figures'
import { ParameterInput } from './parameter-input'
import { SCALARS } from './parameters'
import { useFinance } from './use-finance'

export function LandValue() {
  const { design } = useFeasibility()
  const finance = useFinance()
  if (!design || !finance) return null
  const { landValue, landValuePerUnit } = finance.estimateFor(design)
  const { region } = finance
  const { currency } = region
  return (
    <section aria-label={t('land.title')} className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold">{t('land.title')}</h3>
        <Badge variant="outline">{t('money.estimated')}</Badge>
      </header>
      <div className="flex flex-wrap gap-4">
        <ParameterInput finance={finance} parameter={SCALARS.salePrice} label={t('land.sale-price')} />
        <ParameterInput finance={finance} parameter={SCALARS.margin} label={t('land.margin')} />
      </div>
      <div>
        <p className="text-sm leading-snug font-medium">{t('land.headline', { range: rangeText(landValue, currency) })}</p>
        <p className="text-xs text-muted-foreground">
          {t('land.per-unit', { range: rangeText(landValuePerUnit, currency), unit: region.landUnit.name })}
        </p>
        {landValue.high < 0 && <p className="mt-1 text-xs text-destructive">{t('land.negative')}</p>}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{t('land.indicative')}</p>
      <Disclosure label={t('assumptions.source')} tone="muted">
        <ul className="flex flex-col gap-2 pb-2 text-xs leading-relaxed text-muted-foreground">
          <li>{finance.sourceOf(SCALARS.salePrice)}</li>
          <li>{finance.sourceOf(SCALARS.margin)}</li>
        </ul>
      </Disclosure>
    </section>
  )
}
