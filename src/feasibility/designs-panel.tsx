'use client'

import type { Design, Limiter, Metrics } from '@/designs'
import { Placeholder } from '@/editor/ui'
import type { Limits } from '@/solve'
import { formatQuantity } from '@/text/format'
import { t } from '@/text/messages'
import { checkRow, type CheckRow, type CheckStatus } from './checklist'
import { Disclosure } from './disclosure'
import { useFeasibility } from './feasibility-provider'
import { limiterText } from './limiter-text'
import { WhenReady } from './ready'
import { Sources } from './sources'
import { Tally } from './tally'
import { yieldFigure, type Figure } from './yield-figure'

const STATUS_STYLE: Readonly<Record<CheckStatus, { mark: string; tone: string }>> = {
  pass: { mark: '✓', tone: 'bg-plot-wash text-plot' },
  fail: { mark: '✕', tone: 'bg-signal text-paper' },
  manual: { mark: '?', tone: 'bg-road/20 text-road-ink' },
}

function Metric({ label, value }: Figure) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-slate">{label}</dt>
      <dd className="font-mono text-sm tabular-nums">{value}</dd>
    </div>
  )
}

function FloorAreaBar({ metrics, limitedBy, limits }: { metrics: Metrics; limitedBy: Limiter; limits: Limits }) {
  const share = Math.min(1, metrics.gfaSqm / limits.far.maxGfaSqm)
  return (
    <div className="mt-4">
      <p className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="font-mono text-base font-medium tabular-nums">{formatQuantity(metrics.gfaSqm, 'sqm')}</span>
        <span className="font-mono text-xs text-slate tabular-nums">
          {t('metric.gfa-of-max', { max: formatQuantity(limits.far.maxGfaSqm, 'sqm') })}
        </span>
      </p>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-vellum" aria-hidden="true">
        <div className="h-full rounded-full bg-plot" style={{ width: `${share * 100}%` }} />
      </div>
      <p className="mt-1.5 text-xs leading-snug text-slate">{limiterText(limitedBy, limits)}</p>
    </div>
  )
}

function CheckItem({ row }: { row: CheckRow }) {
  const { mark, tone } = STATUS_STYLE[row.status]
  const failed = row.status === 'fail'
  return (
    <li className="flex gap-3 py-2.5">
      <span className={`mt-px grid size-5 shrink-0 place-items-center rounded-full font-mono text-2xs font-medium ${tone}`}>
        <span aria-hidden="true">{mark}</span>
        <span className="sr-only">{t(`status.${row.status}`)}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm leading-snug ${failed ? 'font-medium text-signal' : ''}`}>{t(`check.${row.id}`)}</p>
        <p className={`mt-0.5 font-mono text-xs tabular-nums ${failed ? 'text-signal' : 'text-slate'}`}>{row.reading ?? t('check.manual')}</p>
        <Sources cites={row.cites} />
      </div>
    </li>
  )
}

type DesignCardProps = { design: Design; limits: Limits; selected: boolean; onSelect: () => void }

function DesignCard({ design, limits, selected, onSelect }: DesignCardProps) {
  const { metrics } = design
  const name = t(design.nameKey)
  return (
    <li
      aria-label={name}
      className={`@container rounded-xl border bg-paper p-4 transition-[border-color,box-shadow] duration-150 ${selected ? 'border-plot shadow-[0_0_0_1px_var(--color-plot)]' : 'border-rule'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-base leading-snug font-semibold">{name}</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-slate">{t(`${design.nameKey}.summary`)}</p>
        </div>
        <button
          type="button"
          aria-pressed={selected}
          aria-label={t('design.show', { name })}
          onClick={onSelect}
          className="h-11 shrink-0 rounded-md border border-rule px-3 text-xs font-medium text-ink transition-colors duration-150 hover:border-plot hover:text-plot active:translate-y-px aria-pressed:border-plot aria-pressed:bg-plot aria-pressed:text-paper lg:h-8"
        >
          {t(selected ? 'design.shown' : 'design.view')}
        </button>
      </div>
      <FloorAreaBar metrics={metrics} limitedBy={design.limitedBy} limits={limits} />
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 @[17rem]:grid-cols-3">
        <Metric label={t('metric.far')} value={formatQuantity(metrics.far, 'ratio')} />
        <Metric label={t('metric.height')} value={formatQuantity(metrics.heightM, 'm')} />
        <Metric label={t('metric.storeys')} value={formatQuantity(metrics.storeys, 'count')} />
        <Metric {...yieldFigure(metrics.yield)} />
        <Metric label={t('metric.parking')} value={t('metric.spaces', { count: formatQuantity(metrics.parkingSpaces, 'count') })} />
        <Metric label={t('metric.open-space')} value={formatQuantity(metrics.openSpaceSqm, 'sqm')} />
      </dl>
      <div className="mt-4 border-t border-rule pt-3">
        <Tally checks={design.checks} />
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
