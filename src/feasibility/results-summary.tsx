'use client'

import type { ReactNode } from 'react'
import { useRegion } from '@/editor/plot-store'
import { formatQuantity } from '@/text/format'
import { t } from '@/text/messages'
import { failureText } from './failure-text'
import { useFeasibility } from './feasibility-provider'
import { limiterText } from './limiter-text'
import { SummarySkeleton } from './results-skeleton'
import { ShareActions } from './share-actions'
import { VerificationNote } from './verification-note'

export function ResultsSummary({ children }: { children?: ReactNode }) {
  const { result, design } = useFeasibility()
  const region = useRegion()
  const { areaUnit } = region
  if (!result) return <SummarySkeleton />
  if (result.status === 'failed') return <p className="text-sm leading-snug text-destructive">{failureText(result, region)}</p>
  if (!design) return <p className="text-sm leading-snug text-muted-foreground">{t('designs.none')}</p>
  const { solution } = result
  const best = t('summary.best', { name: t('design.name', design.name), area: formatQuantity(design.metrics.gfaSqm, areaUnit) })
  return (
    <section aria-label={t('summary.label')}>
      <div className="flex items-start justify-between gap-2">
        <p className="pt-1 text-xs text-muted-foreground">{t('summary.allowed')}</p>
        <ShareActions />
      </div>
      <p aria-live="polite" aria-atomic="true" className="flex flex-wrap items-baseline gap-x-2">
        <span key={solution.farCap.maxGfaSqm} className="animate-flash rounded text-2xl font-semibold tracking-tight">
          {formatQuantity(solution.farCap.maxGfaSqm, areaUnit)}
        </span>
        <span className="text-sm text-muted-foreground">{t('summary.allowed-unit')}</span>
      </p>
      <VerificationNote solution={solution} className="mt-1" />
      <p key={`${best}${design.limitedBy}`} className="mt-1 animate-flash rounded text-xs leading-snug text-muted-foreground">
        {best} {limiterText(design.limitedBy, solution)}
      </p>
      {children}
    </section>
  )
}
