import { useEffect, useMemo, useState } from 'react'
import type { LngLat } from '@/geo/projection'
import { ZONE_DEBOUNCE_MS } from './assumptions'
import { unknownVerdict, zoneRegionFor } from './classify'
import { zoneCheck, type ZoneCheck } from './cross-check'
import { lookupZone, snapshotZone } from './lookup'
import { fetchZoneSnapshot, type ZoneSnapshot } from './snapshot'
import { ZONE_SOURCES, type ZoneRegionId } from './sources'
import { ringKey, type ZoneVerdict } from './verdict'

type Outcome = { readonly key: string; readonly verdict: ZoneVerdict }

type Loaded = { readonly region: ZoneRegionId; readonly snapshot: ZoneSnapshot | null }

const keyOf = (ring: readonly LngLat[] | null) => (ring ? ringKey(ring) : null)

function unreachable(ring: readonly LngLat[]): ZoneVerdict {
  const region = zoneRegionFor(ring)
  return unknownVerdict(region && ZONE_SOURCES[region], 'unreachable')
}

function useSnapshot(region: ZoneRegionId | undefined): ZoneSnapshot | null {
  const [loaded, setLoaded] = useState<Loaded | null>(null)

  useEffect(() => {
    if (!region) return
    let current = true
    fetchZoneSnapshot(ZONE_SOURCES[region]).then(
      (snapshot) => current && setLoaded({ region, snapshot }),
      () => current && setLoaded({ region, snapshot: null }),
    )
    return () => {
      current = false
    }
  }, [region])

  return loaded && loaded.region === region ? loaded.snapshot : null
}

function useLiveVerdict(ring: readonly LngLat[] | null): ZoneVerdict | null {
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

export function useZone(plotRing: readonly LngLat[] | null): ZoneCheck | null {
  const [ring, setRing] = useState(plotRing)
  if (keyOf(ring) !== keyOf(plotRing)) setRing(plotRing)
  const region = ring ? zoneRegionFor(ring) : undefined
  const snapshot = useSnapshot(region)
  const live = useLiveVerdict(ring)
  const fromSnapshot = useMemo(() => (ring && region && snapshot ? snapshotZone(ring, region, snapshot) : null), [ring, region, snapshot])
  return useMemo(() => zoneCheck(fromSnapshot, live), [fromSnapshot, live])
}
