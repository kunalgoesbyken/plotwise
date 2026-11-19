'use client'

import type { Design, Metrics, Yield } from '@/designs'
import { Placeholder } from '@/editor/ui'
import type { Limits } from '@/solve'
import { formatQuantity } from '@/text/format'
import { t } from '@/text/messages'
import { checkRow, tally, type CheckRow, type CheckStatus } from './checklist'
import { Disclosure } from './disclosure'
import { useFeasibility } from './feasibility-provider'
import { WhenReady } from './ready'
import { Sources } from './sources'

const STATUS_STYLE: Readonly<Record<CheckStatus, { mark: string; tone: string }>> = {
  pass: { mark: '✓', tone: 'bg-plot-wash text-plot' },
  fail: { mark: '✕', tone: 'bg-signal text-paper' },
  manual: { mark: '?', tone: 'bg-road/20 text-road-ink' },
}

function yieldText(output: Yield): string {
  switch (output.kind) {
    case 'units':
      return t('metric.units', { count: formatQuantity(output.count, 'count') })
    case 'rooms':
      return t('metric.rooms', { count: formatQuantity(output.count, 'count') })
    case 'netArea':
      return t('metric.net-area', { area: formatQuantity(output.sqm, 'sqm') })
  }
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="font-mono text-[10px] tracking-wide text-slate uppercase">{label}</dt>
      <dd className="font-mono text-sm tabular-nums">{value}</dd>
    </div>
  )
}

function FloorAreaBar({ metrics, limits }: { metrics: Metrics; limits: Limits }) {
  const share = Math.min(1, metrics.gfaSqm / limits.far.maxGfaSqm)
  return (
    <div className="mt-3">
      <p className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
        <span className="font-mono font-medium tabular-nums">{formatQuantity(metrics.gfaSqm, 'sqm')}</span>
        <span className="font-mono text-xs text-slate tabular-nums">
          {t('metric.gfa-of-max', { max: formatQuantity(limits.far.maxGfaSqm, 'sqm') })}
        </span>
      </p>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-vellum" aria-hidden="true">
        <div className="h-full rounded-full bg-plot" style={{ width: `${share * 100}%` }} />
      </div>
    </div>
  )
}

function CheckItem({ row }: { row: CheckRow }) {
  const { mark, tone } = STATUS_STYLE[row.status]
  return (
    <li className="flex gap-2.5 py-2">
      <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full font-mono text-[11px] font-medium ${tone}`}>
        <span aria-hidden="true">{mark}</span>
        <span className="sr-only">{t(`status.${row.status}`)}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm leading-snug ${row.status === 'fail' ? 'font-medium text-signal' : ''}`}>{t(`check.${row.id}`)}</p>
        <p className={`font-mono text-xs tabular-nums ${row.status === 'fail' ? 'text-signal' : 'text-slate'}`}>
          {row.reading ?? t('check.manual')}
        </p>
        <Sources cites={row.cites} />
      </div>
    </li>
  )
}

function Tally({ design }: { design: Design }) {
  const counts = tally(design.checks)
  return (
    <p className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs tabular-nums">
      <span className="text-plot">{t('tally.pass', { count: counts.pass })}</span>
      <span className={counts.fail > 0 ? 'font-medium text-signal' : 'text-slate'}>{t('tally.fail', { count: counts.fail })}</span>
      <span className="text-road-ink">{t('tally.manual', { count: counts.manual })}</span>
    </p>
  )
}

type DesignCardProps = { design: Design; limits: Limits; selected: boolean; onSelect: () => void }

function DesignCard({ design, limits, selected, onSelect }: DesignCardProps) {
  const { metrics } = design
  const name = t(design.nameKey)
  return (
    <li
      aria-label={name}
      className={`rounded-lg border p-3 transition-colors ${selected ? 'border-plot bg-paper shadow-sm ring-1 ring-plot' : 'border-rule bg-paper'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold leading-tight">{name}</h3>
          <p className="mt-0.5 text-xs leading-snug text-slate">{t(`${design.nameKey}.summary`)}</p>
        </div>
        <button
          type="button"
          aria-pressed={selected}
          aria-label={t('design.show', { name })}
          onClick={onSelect}
          className="min-h-11 shrink-0 rounded-md border border-rule px-3 text-xs font-medium text-ink transition-colors hover:border-plot aria-pressed:border-plot aria-pressed:bg-plot aria-pressed:text-paper lg:min-h-8"
        >
          {t(selected ? 'design.shown' : 'design.view')}
        </button>
      </div>
      <FloorAreaBar metrics={metrics} limits={limits} />
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
        <Metric label={t('metric.far')} value={formatQuantity(metrics.far, 'ratio')} />
        <Metric label={t('metric.height')} value={formatQuantity(metrics.heightM, 'm')} />
        <Metric label={t('metric.storeys')} value={formatQuantity(metrics.storeys, 'count')} />
        <Metric label={t('metric.yield')} value={yieldText(metrics.yield)} />
        <Metric label={t('metric.parking')} value={t('metric.spaces', { count: formatQuantity(metrics.parkingSpaces, 'count') })} />
        <Metric label={t('metric.open-space')} value={formatQuantity(metrics.openSpaceSqm, 'sqm')} />
      </dl>
      <div className="mt-3 border-t border-rule pt-2">
        <Tally design={design} />
        <Disclosure label={t('design.checklist')}>
          <ul className="divide-y divide-rule/70">
            {design.checks.map((check) => (
              <CheckItem key={check.id} row={checkRow(check)} />
            ))}
          </ul>
        </Disclosure>
      </div>
    </li>
  )
}

function DesignList({ designs, limits }: { designs: readonly Design[]; limits: Limits }) {
  const { design: selected, selectDesign } = useFeasibility()
  if (designs.length === 0) return <Placeholder>{t('designs.none')}</Placeholder>
  return (
    <ul className="flex flex-col gap-3">
      {designs.map((design) => (
        <DesignCard
          key={design.id}
          design={design}
          limits={limits}
          selected={design.id === selected?.id}
          onSelect={() => selectDesign(design.id)}
        />
      ))}
    </ul>
  )
}

export function DesignsPanel() {
  return <WhenReady render={({ solution, designs }) => <DesignList designs={designs} limits={solution.limits} />} />
}
