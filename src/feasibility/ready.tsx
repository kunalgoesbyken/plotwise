'use client'

import type { ReactNode } from 'react'
import type { Design } from '@/designs'
import { Placeholder } from '@/editor/ui'
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
      <p role="alert" className="rounded-md border border-signal/40 bg-signal/5 p-3 text-sm leading-relaxed text-signal">
        {t(`feasibility.failed.${result.reason}`)}
      </p>
    )
  }
  return render({ plot, solution: result.solution, designs: result.designs })
}
