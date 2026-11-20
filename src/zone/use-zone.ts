import { useEffect, useState } from 'react'
import type { LngLat } from '@/geo/projection'
import { ZONE_DEBOUNCE_MS } from './assumptions'
import { fetchZone } from './client'
import { sourceFor, unknownVerdict } from './classify'
import { encodeRing, type ZoneVerdict } from './schema'

type Outcome = { readonly key: string; readonly verdict: ZoneVerdict }

export function useZone(plotRing: readonly LngLat[]): ZoneVerdict | null {
  const [ring, setRing] = useState(plotRing)
  if (encodeRing(ring) !== encodeRing(plotRing)) setRing(plotRing)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  useEffect(() => {
    const key = encodeRing(ring)
    const controller = new AbortController()
    const timer = setTimeout(() => {
      fetchZone(ring, { signal: controller.signal }).then(
        (verdict) => {
          if (!controller.signal.aborted) setOutcome({ key, verdict })
        },
        () => {
          if (!controller.signal.aborted) setOutcome({ key, verdict: unknownVerdict(sourceFor(ring), 'unreachable') })
        },
      )
    }, ZONE_DEBOUNCE_MS.value)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [ring])

  return outcome?.key === encodeRing(ring) ? outcome.verdict : null
}
