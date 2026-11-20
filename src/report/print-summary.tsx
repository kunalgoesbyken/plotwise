'use client'

import type { ReactNode } from 'react'
import type { Design } from '@/designs'
import { tally } from '@/feasibility/checklist'
import { useFeasibility } from '@/feasibility/feasibility-provider'
import { firstCostRange, rangeText } from '@/finance/figures'
import { formatMoney } from '@/finance/format-money'
import { RATES, SCALARS, type Parameter, type ScalarId } from '@/finance/parameters'
import { useFinance, type Finance } from '@/finance/use-finance'
import type { Loop, Polygon } from '@/geometry'
import { REGION } from '@/region/regions'
import { formatQuantity } from '@/text/format'
import { t } from '@/text/messages'

const DRAWING_PX = 220

function PlotDrawing({ ring, footprint }: { ring: Loop; footprint: readonly Polygon[] }) {
  const xs = ring.map(([x]) => x)
  const ys = ring.map(([, y]) => y)
  const [minX, maxY] = [Math.min(...xs), Math.max(...ys)]
  const size = Math.max(Math.max(...xs) - minX, maxY - Math.min(...ys))
  const points = (loop: Loop) => loop.map(([x, y]) => `${x - minX},${maxY - y}`).join(' ')
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={DRAWING_PX} height={DRAWING_PX} aria-hidden="true" className="overflow-visible">
      <polygon points={points(ring)} fill="none" stroke="currentColor" strokeWidth={size / 150} />
      {footprint.map((polygon, index) => (
        <polygon key={index} points={points(polygon.outer)} fill="currentColor" fillOpacity={0.15} stroke="currentColor" strokeWidth={size / 300} />
      ))}
    </svg>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-dotted py-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  )
}

function valueText(finance: Finance, parameter: Parameter) {
  const value = finance.valueOf(parameter)
  if (parameter.unit === 'money') return formatMoney(value, finance.region.currency)
  if (parameter.unit === 'share') return formatQuantity(value, 'percent')
  return formatQuantity(value, 'count')
}

function Assumptions({ finance }: { finance: Finance }) {
  return (
    <dl className="columns-2 gap-8 text-xs">
      {(Object.keys(SCALARS) as ScalarId[]).map((id) => (
        <Fact key={id} label={t(`assumptions.${id}`)}>
          {valueText(finance, SCALARS[id])}
        </Fact>
      ))}
      {RATES.map(({ row, low, high }) => (
        <Fact key={row} label={t(`assumptions.rate.${row}`)}>
          {t('money.range', { low: valueText(finance, low), high: valueText(finance, high) })}
        </Fact>
      ))}
    </dl>
  )
}

function DesignFacts({ design, finance }: { design: Design; finance: Finance }) {
  const estimate = finance.estimateFor(design)
  const { currency } = finance.region
  const counts = tally(design.checks)
  return (
    <dl className="text-sm">
      <Fact label={t('metric.floor-area')}>{formatQuantity(design.metrics.gfaSqm, 'sqm')}</Fact>
      <Fact label={t('money.built-up')}>{formatQuantity(estimate.builtSqm, 'sqm')}</Fact>
      <Fact label={t('money.saleable')}>{formatQuantity(estimate.saleableSqm, 'sqm')}</Fact>
      <Fact label={t('metric.height')}>{formatQuantity(design.metrics.heightM, 'm')}</Fact>
      <Fact label={t('metric.storeys')}>{formatQuantity(design.metrics.storeys, 'count')}</Fact>
      <Fact label={t('money.first-cost')}>{rangeText(firstCostRange(estimate), currency)}</Fact>
      <Fact label={t('money.land-value')}>{rangeText(estimate.landValue, currency)}</Fact>
      <Fact label={t('metric.checks')}>
        {[t('tally.pass', { count: counts.pass }), t('tally.manual', { count: counts.manual }), t('tally.fail', { count: counts.fail })].join(' · ')}
      </Fact>
    </dl>
  )
}

export function PrintSummary() {
  const { result, design } = useFeasibility()
  const finance = useFinance()
  if (result?.status !== 'ready' || !design || !finance) return null
  const { site, farCap } = result.solution
  const toCheck = design.checks.filter((check) => check.status !== 'pass')
  return (
    <article className="hidden flex-col gap-6 p-8 text-foreground print:flex">
      <header className="flex items-baseline justify-between border-b pb-3">
        <h1 className="text-xl font-semibold">{t('report.title', { city: REGION.city })}</h1>
        <p className="text-xs text-muted-foreground">{REGION.zone.name}</p>
      </header>
      <section className="flex gap-8">
        <PlotDrawing ring={site.ring} footprint={design.plates.footprint} />
        <div className="flex-1">
          <h2 className="text-sm font-semibold">{t(design.nameKey)}</h2>
          <p className="mb-2 text-xs text-muted-foreground">
            {t('report.plot', { area: formatQuantity(site.areaSqm, 'sqm'), allowed: formatQuantity(farCap.maxGfaSqm, 'sqm') })}
          </p>
          <DesignFacts design={design} finance={finance} />
        </div>
      </section>
      {toCheck.length > 0 && (
        <section>
          <h2 className="mb-1 text-sm font-semibold">{t('report.open')}</h2>
          <ul className="text-xs">
            {toCheck.map((check) => (
              <li key={check.id} className="border-b border-dotted py-1">
                {t(`status.${check.status}`)}: {t(`check.${check.id}`)}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h2 className="mb-1 text-sm font-semibold">{t('report.assumptions')}</h2>
        <Assumptions finance={finance} />
      </section>
      <footer className="border-t pt-3 text-2xs break-all text-muted-foreground">
        {t('report.disclaimer')} {location.href}
      </footer>
    </article>
  )
}
