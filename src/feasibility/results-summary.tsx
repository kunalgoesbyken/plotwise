'use client'

import type { ReactNode } from 'react'
import { useRegion } from '@/editor/plot-store'
import { formatQuantity } from '@/text/format'
import { t } from '@/text/messages'
import { CapLine, capFigures } from './cap-line'
import { FailureNotice } from './failure-notice'
import { useFeasibility } from './feasibility-provider'
import { limiterText } from './limiter-text'
import { SummarySkeleton } from './results-skeleton'
import { ShareActions } from './share-actions'
import { VerificationNote } from './verification-note'

export function ResultsSummary({ children }: { children?: ReactNode }) {
  const { result, design, highRiseCostSqm } = useFeasibility()
  const { areaUnit } = useRegion()
  if (!result) return <SummarySkeleton />
  if (result.status === 'failed') return <FailureNotice failure={result} />
  if (!design) return <p className="text-sm leading-snug text-muted-foreground">{t('designs.none')}</p>
  const { solution } = result
  const { gfaSqm } = design.metrics
  const cap = capFigures(design, solution, highRiseCostSqm)
  return (
    <section aria-label={t('summary.label')}>
      <div className="flex items-start justify-between gap-2">
        <p className="pt-1 text-xs text-muted-foreground">{t('summary.buildable')}</p>
        <ShareActions />
      </div>
      <p aria-live="polite" aria-atomic="true" className="flex flex-wrap items-baseline gap-x-2">
        <span key={gfaSqm} className="animate-flash rounded text-2xl font-semibold tracking-tight">
          {formatQuantity(gfaSqm, areaUnit)}
        </span>
        <span className="text-sm text-muted-foreground">{t('design.name', design.name)}</span>
      </p>
      <CapLine figures={cap} unit={areaUnit} className="mt-1" />
      <VerificationNote solution={solution} className="mt-1" />
      {!cap.reached && (
        <p key={design.limitedBy} className="mt-1 animate-flash rounded text-xs leading-snug text-muted-foreground">
          {limiterText(design.limitedBy, solution)}
        </p>
      )}
      {children}
    </section>
  )
}
