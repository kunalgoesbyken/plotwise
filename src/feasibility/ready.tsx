'use client'

import type { ReactNode } from 'react'
import type { Design } from '@/designs'
import type { Plot } from '@/plot/plot'
import type { Solution } from '@/solve'
import { useFeasibility } from './feasibility-provider'
import { ResultsSkeleton } from './results-skeleton'

export type Ready = { readonly plot: Plot; readonly solution: Solution; readonly designs: readonly Design[] }

export function WhenReady({ render }: { render: (ready: Ready) => ReactNode }) {
  const { plot, result } = useFeasibility()
  if (!plot || !result) return <ResultsSkeleton />
  if (result.status === 'failed') return null
  return render({ plot, solution: result.solution, designs: result.designs })
}
