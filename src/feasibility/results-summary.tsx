'use client'

import { formatQuantity } from '@/text/format'
import { t } from '@/text/messages'
import { useFeasibility } from './feasibility-provider'
import { limiterText } from './limiter-text'

export function ResultsSummary() {
  const { result, design } = useFeasibility()
  if (!result) return null
  if (result.status === 'failed') return <p className="text-sm leading-snug text-destructive">{t(`feasibility.failed.${result.reason}`)}</p>
  if (!design) return <p className="text-sm leading-snug text-muted-foreground">{t('designs.none')}</p>
  const { limits } = result.solution
  const best = t('summary.best', { name: t(design.nameKey), area: formatQuantity(design.metrics.gfaSqm, 'sqm') })
  return (
    <section aria-label={t('summary.label')}>
      <p className="text-xs text-muted-foreground">{t('summary.allowed')}</p>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span key={limits.far.maxGfaSqm} className="animate-flash rounded text-2xl font-semibold tracking-tight">
          {formatQuantity(limits.far.maxGfaSqm, 'sqm')}
        </span>
        <span className="text-sm text-muted-foreground">{t('summary.allowed-unit')}</span>
      </p>
      <p key={`${best}${design.limitedBy}`} className="mt-1 animate-flash rounded text-xs leading-snug text-muted-foreground">
        {best} {limiterText(design.limitedBy, limits)}
      </p>
    </section>
  )
}
