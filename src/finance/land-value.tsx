'use client'

import { useFeasibility } from '@/feasibility/feasibility-provider'
import { formatNumber } from '@/text/format'
import { t } from '@/text/messages'
import { Badge } from '@/ui/badge'
import { Disclosure } from '@/ui/disclosure'
import { rangeText } from './figures'
import { ParameterInput } from './parameter-input'
import { SCALARS } from './parameters'
import { useFinance, type Finance } from './use-finance'

function areaText({ area, region }: Finance) {
  const name = t(`area.${area.tier}`)
  if (!area.determined) return t('land.area-unknown', { area: name })
  return t('land.area', { area: name, km: formatNumber(area.distanceKm, 'km'), centre: region.areas.centre.name })
}

export function LandValue() {
  const { design } = useFeasibility()
  const finance = useFinance()
  if (!design || !finance) return null
  const estimate = finance.estimateFor(design)
  const { landValue, landValuePerUnit } = estimate
  const { reference, exceeds } = finance.landCheckOf(estimate)
  const { region } = finance
  const { currency } = region
  return (
    <section aria-label={t('land.title')} className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold">{t('land.title')}</h3>
        <Badge variant="outline">{t('money.estimated')}</Badge>
      </header>
      <p className="text-xs text-muted-foreground">{areaText(finance)}</p>
      <div className="flex flex-wrap gap-4">
        <ParameterInput finance={finance} parameter={SCALARS.salePrice} label={t('land.sale-price')} />
        <ParameterInput finance={finance} parameter={SCALARS.margin} label={t('land.margin')} />
      </div>
      <div>
        <p className="text-sm leading-snug font-medium">{t('land.headline', { range: rangeText(landValue, currency) })}</p>
        <p className="text-xs text-muted-foreground">
          {t('land.per-unit', { range: rangeText(landValuePerUnit, currency), unit: region.landUnit.name })}
        </p>
        <p className="text-xs text-muted-foreground">
          {t('land.reference', { range: rangeText(reference, currency), unit: region.landUnit.name })}
        </p>
        {landValue.high < 0 && <p className="mt-1 text-xs text-destructive">{t('land.negative')}</p>}
        {exceeds && <p className="mt-1 text-xs text-destructive">{t('land.above-reference', { factor: region.landWarningFactor.value })}</p>}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{t('land.indicative')}</p>
      <Disclosure label={t('assumptions.source')} tone="muted">
        <ul className="flex flex-col gap-2 pb-2 text-xs leading-relaxed text-muted-foreground">
          <li>{region.areas.source}</li>
          <li>{finance.sourceOf(SCALARS.salePrice)}</li>
          <li>{finance.sourceOf(SCALARS.margin)}</li>
          <li>{finance.sourceOf(SCALARS.landReferenceLow)}</li>
        </ul>
      </Disclosure>
    </section>
  )
}
