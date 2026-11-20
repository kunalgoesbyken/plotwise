import { useEffect, useState } from 'react'
import type { LngLat } from '@/geo/projection'
import { plotSiteBbox, type Bbox } from '@/site/bbox'
import { loadSharedSite, siteCell } from '@/site/shared-site'
import type { Site } from '@/site/schema'
import type { RegionId } from '@/solve'
import { useSettled } from './use-settled'

export type SiteStatus = 'loading' | 'ready' | 'failed'

type Outcome = { readonly bbox: Bbox; readonly attempt: number; readonly ok: boolean }

export function useSite(ring: readonly LngLat[], region: RegionId) {
  const bbox = useSettled(plotSiteBbox(ring), (kept, next) => siteCell(kept, region) !== siteCell(next, region))
  const [attempt, setAttempt] = useState(0)
  const [site, setSite] = useState<Site | null>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    loadSharedSite(bbox, region, { signal: controller.signal }).then(
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
  }, [bbox, region, attempt])

  const status: SiteStatus =
    outcome?.bbox !== bbox || outcome.attempt !== attempt ? 'loading' : outcome.ok ? 'ready' : 'failed'
  return { site, status, retry: () => setAttempt((n) => n + 1) }
}
