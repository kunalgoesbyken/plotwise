import { useEffect, useState } from 'react'
import type { LngLat } from '@/geo/projection'
import { ZONE_DEBOUNCE_MS } from './assumptions'
import { unknownVerdict, zoneRegionFor } from './classify'
import { lookupZone } from './lookup'
import { ZONE_SOURCES } from './sources'
import { ringKey, type ZoneVerdict } from './verdict'

type Outcome = { readonly key: string; readonly verdict: ZoneVerdict }

const keyOf = (ring: readonly LngLat[] | null) => (ring ? ringKey(ring) : null)

function unreachable(ring: readonly LngLat[]): ZoneVerdict {
  const region = zoneRegionFor(ring)
  return unknownVerdict(region && ZONE_SOURCES[region], 'unreachable')
}

export function useZone(plotRing: readonly LngLat[] | null): ZoneVerdict | null {
  const [ring, setRing] = useState(plotRing)
  if (keyOf(ring) !== keyOf(plotRing)) setRing(plotRing)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  useEffect(() => {
    if (!ring) return
    const key = ringKey(ring)
    const controller = new AbortController()
    const timer = setTimeout(() => {
      lookupZone(ring, controller.signal).then(
        (verdict) => {
          if (!controller.signal.aborted) setOutcome({ key, verdict })
        },
        () => {
          if (!controller.signal.aborted) setOutcome({ key, verdict: unreachable(ring) })
        },
      )
    }, ZONE_DEBOUNCE_MS.value)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [ring])

  return outcome && outcome.key === keyOf(ring) ? outcome.verdict : null
}
