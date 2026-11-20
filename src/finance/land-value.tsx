'use client'

import type { Design } from '@/designs'
import { useRegion } from '@/editor/plot-store'
import { useFeasibility } from '@/feasibility/feasibility-provider'
import { formatNumber } from '@/text/format'
import { t } from '@/text/messages'
import { Badge } from '@/ui/badge'
import { Disclosure } from '@/ui/disclosure'
import { rangeText } from './figures'
import { ParameterInput } from './parameter-input'
import { SCALARS } from './parameters'
import { useFinance, type Finance, type Priced } from './use-finance'

function areaText({ area, region }: Finance) {
  if (!area || !region.prices) return null
  const name = t(`area.${area.tier}`)
  if (!area.determined) return t('land.area-unknown', { area: name })
  return t('land.area', { area: name, km: formatNumber(area.distanceKm, 'km'), centre: region.prices.areas.centre.name })
}

function Supported({ finance, priced, design }: { finance: Finance; priced: Priced; design: Design }) {
  const estimate = priced.estimateFor(design)
  const { landValue, landValuePerUnit } = estimate
  const { reference, exceeds } = priced.landCheckOf(estimate)
  const { currency, landUnit, landWarningFactor } = finance.region
  return (
    <div>
      <p className="text-sm leading-snug font-medium">{t('land.headline', { range: rangeText(landValue, currency) })}</p>
      <p className="text-xs text-muted-foreground">{t('land.per-unit', { range: rangeText(landValuePerUnit, currency), unit: landUnit.name })}</p>
      <p className="text-xs text-muted-foreground">{t('land.reference', { range: rangeText(reference, currency), unit: landUnit.name })}</p>
      {landValue.high < 0 && <p className="mt-1 text-xs text-destructive">{t('land.negative')}</p>}
      {exceeds && <p className="mt-1 text-xs text-destructive">{t('land.above-reference', { factor: landWarningFactor.value })}</p>}
    </div>
  )
}

function NeedsPrices({ finance }: { finance: Finance }) {
  const { name } = useRegion()
  return (
    <div role="note" className="flex flex-col gap-1 text-xs leading-relaxed">
      <p className="text-foreground">{t('money.needs-prices', { region: name })}</p>
      <p className="font-medium text-destructive">{t('money.missing', { count: finance.missing.length })}</p>
    </div>
  )
}

function PriceSources({ finance }: { finance: Finance }) {
  const { prices } = finance.region
  if (!prices) return null
  return (
    <Disclosure label={t('assumptions.source')} tone="muted">
      <ul className="flex flex-col gap-2 pb-2 text-xs leading-relaxed text-muted-foreground">
        <li>{prices.areas.source}</li>
        <li>{finance.sourceOf(SCALARS.salePrice)}</li>
        <li>{finance.sourceOf(SCALARS.margin)}</li>
        <li>{finance.sourceOf(SCALARS.landReferenceLow)}</li>
      </ul>
    </Disclosure>
  )
}

export function LandValue() {
  const { design } = useFeasibility()
  const finance = useFinance()
  const { areaUnit } = useRegion()
  if (!design || !finance) return null
  const area = areaText(finance)
  return (
    <section aria-label={t('land.title')} className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold">{t('land.title')}</h3>
        <Badge variant="outline">{t('money.estimated')}</Badge>
      </header>
      {area && <p className="text-xs text-muted-foreground">{area}</p>}
      <div className="flex flex-wrap gap-4">
        <ParameterInput finance={finance} parameter={SCALARS.salePrice} label={t('land.sale-price', { unit: t(`area-unit.${areaUnit}`) })} />
        <ParameterInput finance={finance} parameter={SCALARS.margin} label={t('land.margin')} />
      </div>
      {finance.priced ? <Supported finance={finance} priced={finance.priced} design={design} /> : <NeedsPrices finance={finance} />}
      <p className="text-xs leading-relaxed text-muted-foreground">{t('land.indicative')}</p>
      <PriceSources finance={finance} />
    </section>
  )
}
