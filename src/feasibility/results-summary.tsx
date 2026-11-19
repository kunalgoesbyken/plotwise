'use client'

import type { Design } from '@/designs'
import type { Limits } from '@/solve'
import { formatQuantity } from '@/text/format'
import { t } from '@/text/messages'
import { useFeasibility } from './feasibility-provider'
import { limiterText } from './limiter-text'
import { Tally } from './tally'
import { yieldFigure, type Figure } from './yield-figure'

function figures({ metrics }: Design, limits: Limits): readonly Figure[] {
  return [
    { label: t('summary.floor-area'), value: formatQuantity(metrics.gfaSqm, 'sqm') },
    { label: t('summary.max-floor-area'), value: formatQuantity(limits.far.maxGfaSqm, 'sqm') },
    { label: t('metric.height'), value: formatQuantity(metrics.heightM, 'm') },
    yieldFigure(metrics.yield),
  ]
}

function Figures({ design, limits }: { design: Design; limits: Limits }) {
  return (
    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 @xs:flex @xs:justify-between">
      {figures(design, limits).map(({ label, value }) => (
        <div key={label}>
          <dt className="text-xs whitespace-nowrap text-slate">{label}</dt>
          <dd key={value} className="-mx-1 w-fit animate-flash rounded px-1 font-mono text-sm font-medium whitespace-nowrap tabular-nums">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function ResultsSummary() {
  const { result, design } = useFeasibility()
  if (!result) return null
  if (result.status === 'failed') return <p className="text-sm leading-snug text-signal">{t(`feasibility.failed.${result.reason}`)}</p>
  if (!design) return <p className="text-sm leading-snug text-slate">{t('designs.none')}</p>
  return (
    <section aria-label={t('summary.label')} className="@container">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 key={design.id} className="animate-flash rounded font-display text-sm font-semibold">
          {t(design.nameKey)}
        </h2>
        <Tally checks={design.checks} />
      </div>
      <Figures design={design} limits={result.solution.limits} />
      <p key={design.limitedBy} className="mt-2 animate-flash rounded text-xs leading-snug text-slate">
        {limiterText(design.limitedBy, result.solution.limits)}
      </p>
    </section>
  )
}
