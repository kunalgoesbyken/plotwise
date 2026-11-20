'use client'

import type { ReactNode } from 'react'
import type { Design } from '@/designs'
import { Placeholder } from '@/ui/section'
import type { Plot } from '@/plot/plot'
import type { Solution } from '@/solve'
import { t } from '@/text/messages'
import { useFeasibility } from './feasibility-provider'

export type Ready = { readonly plot: Plot; readonly solution: Solution; readonly designs: readonly Design[] }

export function WhenReady({ render }: { render: (ready: Ready) => ReactNode }) {
  const { plot, result } = useFeasibility()
  if (!plot || !result) return <Placeholder>{t('feasibility.working')}</Placeholder>
  if (result.status === 'failed') {
    return (
      <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm leading-relaxed text-destructive">
        {t(`feasibility.failed.${result.reason}`)}
      </p>
    )
  }
  return render({ plot, solution: result.solution, designs: result.designs })
}
