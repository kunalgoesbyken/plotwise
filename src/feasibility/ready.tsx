'use client'

import type { ReactNode } from 'react'
import type { Design } from '@/designs'
import type { Plot } from '@/plot/plot'
import type { Solution } from '@/solve'
import { failureText } from './failure-text'
import { useFeasibility } from './feasibility-provider'
import { ResultsSkeleton } from './results-skeleton'

export type Ready = { readonly plot: Plot; readonly solution: Solution; readonly designs: readonly Design[] }

export function WhenReady({ render }: { render: (ready: Ready) => ReactNode }) {
  const { plot, result } = useFeasibility()
  if (!plot || !result) return <ResultsSkeleton />
  if (result.status === 'failed') {
    return (
      <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm leading-relaxed text-destructive">
        {failureText(result)}
      </p>
    )
  }
  return render({ plot, solution: result.solution, designs: result.designs })
}
