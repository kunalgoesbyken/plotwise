'use client'

import type { ReactNode } from 'react'
import { formatQuantity } from '@/text/format'
import { t } from '@/text/messages'
import { useFeasibility } from './feasibility-provider'
import { limiterText } from './limiter-text'
import { ShareActions } from './share-actions'

export function ResultsSummary({ children }: { children?: ReactNode }) {
  const { result, design } = useFeasibility()
  if (!result) return null
  if (result.status === 'failed') return <p className="text-sm leading-snug text-destructive">{t(`feasibility.failed.${result.reason}`)}</p>
  if (!design) return <p className="text-sm leading-snug text-muted-foreground">{t('designs.none')}</p>
  const { limits, farCap } = result.solution
  const best = t('summary.best', { name: t(design.nameKey), area: formatQuantity(design.metrics.gfaSqm, 'sqm') })
  return (
    <section aria-label={t('summary.label')}>
      <div className="flex items-start justify-between gap-2">
        <p className="pt-1 text-xs text-muted-foreground">{t('summary.allowed')}</p>
        <ShareActions />
      </div>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span key={farCap.maxGfaSqm} className="animate-flash rounded text-2xl font-semibold tracking-tight">
          {formatQuantity(farCap.maxGfaSqm, 'sqm')}
        </span>
        <span className="text-sm text-muted-foreground">{t('summary.allowed-unit')}</span>
      </p>
      <p key={`${best}${design.limitedBy}`} className="mt-1 animate-flash rounded text-xs leading-snug text-muted-foreground">
        {best} {limiterText(design.limitedBy, limits)}
      </p>
      {children}
    </section>
  )
}
