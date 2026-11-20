'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import type { Design } from '@/designs'
import { useRegion } from '@/editor/plot-store'
import { checkLabel } from '@/feasibility/check-label'
import type { Region } from '@/region/regions'
import { tally } from '@/feasibility/checklist'
import { useFeasibility } from '@/feasibility/feasibility-provider'
import { VerificationNote } from '@/feasibility/verification-note'
import { firstCostRange, rangeText, rateLabel, scalarLabel } from '@/finance/figures'
import { formatMoney } from '@/finance/format-money'
import { SCALARS, type Parameter, type ScalarId } from '@/finance/parameters'
import { useFinance, type Finance, type Priced } from '@/finance/use-finance'
import type { Loop, Polygon } from '@/geometry'
import { formatQuantity } from '@/text/format'
import { t } from '@/text/messages'
import { perAreaToDisplay, type AreaUnit } from '@/units/area'
import { ZoneStatus } from '@/zone'

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

function valueText(finance: Finance, parameter: Parameter, area: AreaUnit) {
  const value = finance.valueOf(parameter)
  if (value === null) return t('assumptions.blank')
  if (parameter.unit === 'share') return formatQuantity(value, 'percent')
  if (parameter.unit === 'count') return formatQuantity(value, 'count')
  return formatMoney(parameter.unit === 'money' ? perAreaToDisplay(value, area) : value, finance.region.currency)
}

function Assumptions({ finance, region }: { finance: Finance; region: Region }) {
  const area = region.areaUnit
  return (
    <dl className="columns-2 gap-8 text-xs">
      {(Object.keys(SCALARS) as ScalarId[]).map((id) => (
        <Fact key={id} label={scalarLabel(id, region)}>
          {valueText(finance, SCALARS[id], area)}
        </Fact>
      ))}
      {finance.rates.map(({ row, low, high }) => (
        <Fact key={row} label={rateLabel(row, area, finance)}>
          {t('money.range', { low: valueText(finance, low, area), high: valueText(finance, high, area) })}
        </Fact>
      ))}
    </dl>
  )
}

function MoneyFacts({ design, finance, priced, area }: { design: Design; finance: Finance; priced: Priced; area: AreaUnit }) {
  const estimate = priced.estimateFor(design)
  const { areaTerms } = useRegion()
  const { currency } = finance.region
  return (
    <>
      <Fact label={t('money.built-up')}>{formatQuantity(estimate.builtSqm, area)}</Fact>
      <Fact label={t('money.saleable', areaTerms)}>{formatQuantity(estimate.saleableSqm, area)}</Fact>
      <Fact label={t('money.first-cost')}>{rangeText(firstCostRange(estimate), currency)}</Fact>
      {estimate.purchaseCost > 0 && <Fact label={t('money.purchase')}>{formatMoney(estimate.purchaseCost, currency)}</Fact>}
      <Fact label={t('money.land-value')}>{rangeText(estimate.landValue, currency)}</Fact>
    </>
  )
}

function DesignFacts({ design, finance, area }: { design: Design; finance: Finance; area: AreaUnit }) {
  const counts = tally(design.checks)
  return (
    <dl className="text-sm">
      <Fact label={t('metric.floor-area')}>{formatQuantity(design.metrics.gfaSqm, area)}</Fact>
      <Fact label={t('metric.height')}>{formatQuantity(design.metrics.heightM, 'm')}</Fact>
      <Fact label={t('metric.storeys')}>{formatQuantity(design.metrics.storeys, 'count')}</Fact>
      {finance.priced && <MoneyFacts design={design} finance={finance} priced={finance.priced} area={area} />}
      <Fact label={t('metric.checks')}>
        {[t('tally.pass', { count: counts.pass }), t('tally.manual', { count: counts.manual }), t('tally.fail', { count: counts.fail })].join(' · ')}
      </Fact>
    </dl>
  )
}

function useLinkAtPrint() {
  const [href, setHref] = useState('')
  useEffect(() => {
    const capture = () => flushSync(() => setHref(location.href))
    addEventListener('beforeprint', capture)
    return () => removeEventListener('beforeprint', capture)
  }, [])
  return href
}

export function PrintSummary() {
  const { result, design } = useFeasibility()
  const finance = useFinance()
  const region = useRegion()
  const href = useLinkAtPrint()
  if (result?.status !== 'ready' || !design || !finance) return null
  const { site, farCap } = result.solution
  const area = region.areaUnit
  const toCheck = design.checks.filter((check) => check.status !== 'pass')
  const transcribed = Object.values(result.solution.pack.sources).filter((source) => source.textLayer === 'transcribedScan')
  return (
    <article className="hidden flex-col gap-6 p-8 text-foreground print:flex">
      <header className="flex items-baseline justify-between border-b pb-3">
        <h1 className="text-xl font-semibold">{t('report.title', { region: region.name })}</h1>
        {region.zone && <p className="text-xs text-muted-foreground">{region.zone.name}</p>}
      </header>
      <ZoneStatus />
      <VerificationNote solution={result.solution} detailed />
      {transcribed.map((source) => (
        <p key={source.name} className="text-xs text-muted-foreground">
          {t('report.transcribed', { name: source.name })}
        </p>
      ))}
      <section className="flex gap-8">
        <PlotDrawing ring={site.ring} footprint={design.plates.footprint} />
        <div className="flex-1">
          <h2 className="text-sm font-semibold">{t('design.name', design.name)}</h2>
          <p className="mb-2 text-xs text-muted-foreground">
            {t('report.plot', { area: formatQuantity(site.areaSqm, area), allowed: formatQuantity(farCap.maxGfaSqm, area) })}
          </p>
          <DesignFacts design={design} finance={finance} area={area} />
        </div>
      </section>
      {toCheck.length > 0 && (
        <section>
          <h2 className="mb-1 text-sm font-semibold">{t('report.open')}</h2>
          <ul className="text-xs">
            {toCheck.map((check) => (
              <li key={check.id} className="border-b border-dotted py-1">
                {t(`status.${check.status}`)}: {checkLabel(check.id, region.areaTerms)}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h2 className="mb-1 text-sm font-semibold">{t('report.assumptions')}</h2>
        <Assumptions finance={finance} region={region} />
      </section>
      <footer className="border-t pt-3 text-2xs break-all text-muted-foreground">
        {t('report.disclaimer')} {href}
      </footer>
    </article>
  )
}
