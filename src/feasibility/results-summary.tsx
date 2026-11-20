'use client'

import type { Design } from '@/designs'
import { formatQuantity } from '@/text/format'
import { t } from '@/text/messages'
import { useFeasibility } from './feasibility-provider'
import { limiterText } from './limiter-text'
import { Tally } from './tally'
import { yieldFigure, type Figure } from './yield-figure'

function figures({ metrics }: Design): readonly Figure[] {
  return [
    { label: t('summary.design'), value: formatQuantity(metrics.gfaSqm, 'sqm') },
    { label: t('metric.height'), value: formatQuantity(metrics.heightM, 'm') },
    yieldFigure(metrics.yield),
  ]
}

export function ResultsSummary() {
  const { result, design } = useFeasibility()
  if (!result) return null
  if (result.status === 'failed') return <p className="text-sm leading-snug text-destructive">{t(`feasibility.failed.${result.reason}`)}</p>
  if (!design) return <p className="text-sm leading-snug text-muted-foreground">{t('designs.none')}</p>
  const { limits } = result.solution
  return (
    <section aria-label={t('summary.label')} className="@container">
      <p className="text-xs text-muted-foreground">{t('summary.allowed')}</p>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span key={limits.far.maxGfaSqm} className="animate-flash rounded text-2xl font-semibold tracking-tight">
          {formatQuantity(limits.far.maxGfaSqm, 'sqm')}
        </span>
        <span className="text-sm text-muted-foreground">{t('summary.allowed-unit')}</span>
      </p>
      <dl className="mt-3 grid grid-cols-3 gap-x-4">
        {figures(design).map(({ label, value }) => (
          <div key={label} className="min-w-0">
            <dt className="truncate text-xs text-muted-foreground">{label}</dt>
            <dd key={value} className="-mx-1 w-fit animate-flash rounded px-1 text-sm font-medium whitespace-nowrap">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <p key={design.limitedBy} className="mt-2 animate-flash rounded text-xs leading-snug text-muted-foreground">
        {t(design.nameKey)}. {limiterText(design.limitedBy, limits)}
      </p>
      <Tally checks={design.checks} className="mt-2" />
    </section>
  )
}
