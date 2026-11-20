import { useEffect, useMemo, useState } from 'react'
import type { LngLat } from '@/geo/projection'
import { ZONE_DEBOUNCE_MS } from './assumptions'
import { unknownVerdict, zoneRegionFor } from './classify'
import { zoneCheck, type ZoneCheck } from './cross-check'
import { lookupZone } from './lookup'
import { loadZoneSnapshot, snapshotZone, type ZoneSnapshot } from './snapshot'
import { ZONE_SOURCES, type ZoneRegionId } from './sources'
import { ringKey, type ZoneVerdict } from './verdict'

type Outcome = { readonly key: string; readonly verdict: ZoneVerdict }

type Attempt = { readonly region: ZoneRegionId; readonly key: string | null; readonly snapshot: ZoneSnapshot | null }

type SnapshotState = ZoneSnapshot | 'loading' | 'failed'

const keyOf = (ring: readonly LngLat[] | null) => (ring ? ringKey(ring) : null)

function unreachable(ring: readonly LngLat[]): ZoneVerdict {
  const region = zoneRegionFor(ring)
  return unknownVerdict(region && ZONE_SOURCES[region], 'unreachable')
}

function useSnapshot(region: ZoneRegionId | null, key: string | null): SnapshotState | null {
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const snapshot = attempt?.region === region ? attempt.snapshot : null
  const failed = attempt?.region === region && attempt.snapshot === null && attempt.key === key

  useEffect(() => {
    if (!region || snapshot || failed) return
    let current = true
    loadZoneSnapshot(region).then(
      (loaded) => current && setAttempt({ region, key, snapshot: loaded }),
      () => current && setAttempt({ region, key, snapshot: null }),
    )
    return () => {
      current = false
    }
  }, [region, key, snapshot, failed])

  if (!region) return null
  return snapshot ?? (failed ? 'failed' : 'loading')
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

export function useZone(region: ZoneRegionId | null, plotRing: readonly LngLat[] | null): ZoneCheck | null {
  const [ring, setRing] = useState(plotRing)
  if (keyOf(ring) !== keyOf(plotRing)) setRing(plotRing)
  const snapshot = useSnapshot(region, keyOf(ring))
  const live = useLiveVerdict(ring)
  const fromSnapshot = useMemo(
    () => (ring && region && snapshot && typeof snapshot === 'object' ? snapshotZone(ring, region, snapshot) : null),
    [ring, region, snapshot],
  )
  return useMemo(() => (snapshot === 'loading' ? null : zoneCheck(fromSnapshot, live)), [snapshot, fromSnapshot, live])
}
