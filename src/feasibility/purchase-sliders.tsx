'use client'

import { useId, type ReactNode } from 'react'
import { useRegion } from '@/editor/plot-store'
import type { FarPurchase } from '@/rules'
import { PURCHASE_USE_ORDER, type PurchaseOption } from '@/solve'
import { formatQuantity } from '@/text/format'
import { t } from '@/text/messages'
import { Disclosure } from '@/ui/disclosure'
import { useFeasibility } from './feasibility-provider'

const RATIO_STEP = 0.01

function priceText(price: FarPurchase['price'], landRate: string): string {
  switch (price.kind) {
    case 'shareOfLandRate':
      return t('purchase.price.shareOfLandRate', { share: formatQuantity(price.share.value, 'percent'), rate: landRate })
    case 'userSupplied':
      return t('purchase.price.userSupplied')
    case 'perSqm':
      return t('purchase.price.perSqm')
  }
}

function PurchaseSlider({ option, farAreaSqm }: { option: PurchaseOption; farAreaSqm: number }) {
  const id = useId()
  const { buy } = useFeasibility()
  const { areaUnit, areaTerms } = useRegion()
  const maxRatio = option.maxExtraGfaSqm / farAreaSqm
  const ratio = option.chosenGfaSqm / farAreaSqm
  const ratioText = (value: number) => formatQuantity(value, 'ratio')
  const label = t(`purchase.${option.kind}`)
  if (maxRatio <= 0) {
    return (
      <li className="flex items-baseline justify-between gap-3 py-2 text-sm">
        <span>{label}</span>
        <span className="text-xs text-muted-foreground">{t('purchase.none')}</span>
      </li>
    )
  }
  return (
    <li className="flex flex-col gap-1 py-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm">
          {label}
        </label>
        <output htmlFor={id} className="text-xs tabular-nums text-muted-foreground">
          {t('purchase.value', { ratio: ratioText(ratio), max: ratioText(maxRatio), area: formatQuantity(option.chosenGfaSqm, areaUnit) })}
        </output>
      </div>
      <input
        id={id}
        aria-label={label}
        type="range"
        min={0}
        max={maxRatio}
        step={RATIO_STEP}
        value={Math.min(ratio, maxRatio)}
        aria-valuetext={ratioText(ratio)}
        onChange={(event) => buy(option.kind, Number(event.target.value))}
        className="w-full accent-foreground"
      />
      <p className="text-xs text-muted-foreground">{priceText(option.price, areaTerms.landRate)}</p>
    </li>
  )
}

export function PurchaseSliders({ children }: { children?: ReactNode }) {
  const { result } = useFeasibility()
  if (result?.status !== 'ready') return null
  const { limits, farAreaSqm } = result.solution
  const { options } = limits.farPurchase
  if (options.length === 0) return null
  return (
    <section aria-label={t('purchase.title')} className="flex flex-col gap-1">
      <h3 className="text-sm font-semibold">{t('purchase.title')}</h3>
      <p className="text-xs text-muted-foreground">{t('purchase.hint')}</p>
      <Disclosure label={t('purchase.cost-rule')} tone="muted">
        <p className="pb-2 text-xs leading-relaxed text-muted-foreground">{PURCHASE_USE_ORDER}</p>
      </Disclosure>
      <ul className="divide-y">
        {options.map((option) => (
          <PurchaseSlider key={option.kind} option={option} farAreaSqm={farAreaSqm} />
        ))}
      </ul>
      {children}
    </section>
  )
}
