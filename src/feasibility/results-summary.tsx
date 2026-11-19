'use client'

import type { Design, Yield } from '@/designs'
import type { Limits } from '@/solve'
import { formatQuantity } from '@/text/format'
import { t } from '@/text/messages'
import { useFeasibility } from './feasibility-provider'
import { Tally } from './tally'

type Figure = { readonly label: string; readonly value: string }

function yieldFigure(output: Yield): Figure {
  switch (output.kind) {
    case 'units':
      return { label: t('summary.units'), value: formatQuantity(output.count, 'count') }
    case 'rooms':
      return { label: t('summary.rooms'), value: formatQuantity(output.count, 'count') }
    case 'netArea':
      return { label: t('summary.net-area'), value: formatQuantity(output.sqm, 'sqm') }
  }
}

function figures({ metrics }: Design, limits: Limits): readonly Figure[] {
  return [
    { label: t('summary.floor-area'), value: formatQuantity(metrics.gfaSqm, 'sqm') },
    { label: t('summary.max-floor-area'), value: formatQuantity(limits.far.maxGfaSqm, 'sqm') },
    { label: t('summary.height'), value: formatQuantity(metrics.heightM, 'm') },
    yieldFigure(metrics.yield),
  ]
}

function Figures({ design, limits }: { design: Design; limits: Limits }) {
  return (
    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 @xs:grid-cols-4">
      {figures(design, limits).map(({ label, value }) => (
        <div key={label} className="min-w-0">
          <dt className="truncate text-xs text-slate">{label}</dt>
          <dd key={value} className="-mx-1 w-fit animate-flash rounded px-1 font-mono text-sm font-medium tabular-nums">
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
    </section>
  )
}
