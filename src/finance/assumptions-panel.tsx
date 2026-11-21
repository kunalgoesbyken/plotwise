'use client'

import type { ReactNode } from 'react'
import { useRegion } from '@/editor/plot-store'
import { t } from '@/text/messages'
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import { Disclosure } from '@/ui/disclosure'
import { rateLabel, scalarLabel } from './figures'
import { ParameterInput } from './parameter-input'
import { SCALARS, type Parameter, type ScalarId } from './parameters'
import { useFinance, type Finance, type ValueLabel } from './use-finance'

const BADGES: Readonly<Record<ValueLabel, string>> = {
  estimated: t('money.estimated'),
  generic: t('assumptions.generic'),
  example: t('assumptions.example'),
  split: t('assumptions.split'),
}

type RowProps = { readonly label: string; readonly finance: Finance; readonly parameter: Parameter; readonly children: ReactNode }

function Row({ label, finance, parameter, children }: RowProps) {
  const source = finance.sourceOf(parameter)
  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm">{label}</span>
        <Badge variant="outline">{BADGES[finance.labelOf(parameter)]}</Badge>
      </div>
      <div className="flex flex-wrap gap-4">{children}</div>
      {source === null ? (
        <p className="text-xs text-muted-foreground">{t('assumptions.blank')}</p>
      ) : (
        <Disclosure label={t('assumptions.source')} tone="muted">
          <p className="pb-2 text-xs leading-relaxed text-muted-foreground">{source}</p>
        </Disclosure>
      )}
    </li>
  )
}

function ScalarRow({ finance, id }: { finance: Finance; id: ScalarId }) {
  const region = useRegion()
  const parameter = SCALARS[id]
  const label = scalarLabel(id, region)
  return (
    <Row label={label} finance={finance} parameter={parameter}>
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
  const { areaUnit } = useRegion()
  if (!finance) return null
  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-base leading-6 font-semibold">{t('assumptions.title')}</h2>
        {finance.hasEdits && (
          <Button variant="link" size="xs" onClick={finance.resetAll}>
            {t(finance.region.local ? 'assumptions.reset' : 'assumptions.clear')}
          </Button>
        )}
      </header>
      <p className="text-sm leading-relaxed text-muted-foreground">{t('assumptions.note')}</p>
      <Group title={t('assumptions.price')}>
        <ScalarRow finance={finance} id="salePriceLow" />
        <ScalarRow finance={finance} id="salePrice" />
        <ScalarRow finance={finance} id="saleableShare" />
        <ScalarRow finance={finance} id="margin" />
        <ScalarRow finance={finance} id="softCost" />
      </Group>
      <Group title={t('assumptions.land')}>
        <ScalarRow finance={finance} id="transferCosts" />
        <ScalarRow finance={finance} id="holdingCost" />
        <ScalarRow finance={finance} id="landFinance" />
        <ScalarRow finance={finance} id="landReferenceLow" />
        <ScalarRow finance={finance} id="landReferenceHigh" />
      </Group>
      <Group title={t('assumptions.parking')}>
        <ScalarRow finance={finance} id="parkingLevels" />
      </Group>
      <Group title={t('assumptions.rates', { unit: t(`area-unit.${areaUnit}`) })}>
        {finance.rates.map(({ row, low, high }) => (
          <Row key={row} label={rateLabel(row, areaUnit, finance)} finance={finance} parameter={low}>
            <ParameterInput finance={finance} parameter={low} label={t('assumptions.low')} />
            <ParameterInput finance={finance} parameter={high} label={t('assumptions.high')} />
          </Row>
        ))}
      </Group>
    </div>
  )
}
