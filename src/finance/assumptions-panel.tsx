'use client'

import type { ReactNode } from 'react'
import { t } from '@/text/messages'
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import { Disclosure } from '@/ui/disclosure'
import { ParameterInput } from './parameter-input'
import { RATES, SCALARS, type Parameter } from './parameters'
import { useFinance, type Finance } from './use-finance'

function Row({ label, source, children }: { readonly label: string; readonly source: string; readonly children: ReactNode }) {
  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm">{label}</span>
        <Badge variant="outline">{t('money.estimated')}</Badge>
      </div>
      <div className="flex flex-wrap gap-4">{children}</div>
      <Disclosure label={t('assumptions.source')} tone="muted">
        <p className="pb-2 text-xs leading-relaxed text-muted-foreground">{source}</p>
      </Disclosure>
    </li>
  )
}

function ScalarRow({ finance, parameter, label }: { finance: Finance; parameter: Parameter; label: string }) {
  return (
    <Row label={label} source={finance.sourceOf(parameter)}>
      <ParameterInput finance={finance} parameter={parameter} label={label} hideLabel />
    </Row>
  )
}

function Group({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <section aria-label={title}>
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="divide-y">{children}</ul>
    </section>
  )
}

export function AssumptionsPanel() {
  const finance = useFinance()
  if (!finance) return null
  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-base leading-6 font-semibold">{t('assumptions.title')}</h2>
        {finance.hasEdits && (
          <Button variant="link" size="xs" onClick={finance.resetAll}>
            {t('assumptions.reset')}
          </Button>
        )}
      </header>
      <p className="text-sm leading-relaxed text-muted-foreground">{t('assumptions.note')}</p>
      <Group title={t('assumptions.price')}>
        <ScalarRow finance={finance} parameter={SCALARS.salePrice} label={t('assumptions.salePrice')} />
        <ScalarRow finance={finance} parameter={SCALARS.saleableShare} label={t('assumptions.saleableShare')} />
        <ScalarRow finance={finance} parameter={SCALARS.margin} label={t('assumptions.margin')} />
        <ScalarRow finance={finance} parameter={SCALARS.softCost} label={t('assumptions.softCost')} />
      </Group>
      <Group title={t('assumptions.land')}>
        <ScalarRow finance={finance} parameter={SCALARS.transferCosts} label={t('assumptions.transferCosts')} />
        <ScalarRow finance={finance} parameter={SCALARS.holdingCost} label={t('assumptions.holdingCost')} />
        <ScalarRow finance={finance} parameter={SCALARS.landFinance} label={t('assumptions.landFinance')} />
        <ScalarRow finance={finance} parameter={SCALARS.landReferenceLow} label={t('assumptions.landReferenceLow')} />
        <ScalarRow finance={finance} parameter={SCALARS.landReferenceHigh} label={t('assumptions.landReferenceHigh')} />
      </Group>
      <Group title={t('assumptions.parking')}>
        <ScalarRow finance={finance} parameter={SCALARS.parkingLevels} label={t('assumptions.parkingLevels')} />
      </Group>
      <Group title={t('assumptions.rates')}>
        {RATES.map(({ row, low, high }) => (
          <Row key={row} label={t(`assumptions.rate.${row}`)} source={finance.sourceOf(low)}>
            <ParameterInput finance={finance} parameter={low} label={t('assumptions.low')} />
            <ParameterInput finance={finance} parameter={high} label={t('assumptions.high')} />
          </Row>
        ))}
      </Group>
    </div>
  )
}
