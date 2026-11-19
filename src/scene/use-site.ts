import { useEffect, useState } from 'react'
import type { LngLat } from '@/geo/projection'
import { bboxQuery, snapBbox, type Bbox } from '@/site/bbox'
import { fetchSite } from '@/site/client'
import type { Site } from '@/site/schema'
import { contextBbox } from './context'
import { useSettled } from './use-settled'

export type SiteStatus = 'loading' | 'ready' | 'failed'

type Outcome = { readonly bbox: Bbox; readonly attempt: number; readonly ok: boolean }

const cacheCell = (bbox: Bbox) => bboxQuery(snapBbox(bbox))

export function useSite(ring: readonly LngLat[]) {
  const bbox = useSettled(contextBbox(ring), (kept, next) => cacheCell(kept) !== cacheCell(next))
  const [attempt, setAttempt] = useState(0)
  const [site, setSite] = useState<Site | null>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchSite(bbox, { signal: controller.signal }).then(
      (loaded) => {
        if (controller.signal.aborted) return
        setSite(loaded)
        setOutcome({ bbox, attempt, ok: true })
      },
      () => {
        if (!controller.signal.aborted) setOutcome({ bbox, attempt, ok: false })
      },
    )
    return () => controller.abort()
  }, [bbox, attempt])

  const status: SiteStatus =
    outcome?.bbox !== bbox || outcome.attempt !== attempt ? 'loading' : outcome.ok ? 'ready' : 'failed'
  return { site, status, retry: () => setAttempt((n) => n + 1) }
}
