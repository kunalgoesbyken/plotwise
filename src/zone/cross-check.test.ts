import { describe, expect, it } from 'bun:test'
import { zoneCheck, type SnapshotVerdict } from './cross-check'
import { ZONE_SOURCES } from './sources'
import type { ZoneVerdict } from './verdict'

const { bkk } = ZONE_SOURCES
const AS_OF = '2026-11-20T14:55:43.127073Z'
const BROWN = 'brown zone 9 (very high-density residential)'

const inside: ZoneVerdict = { status: 'inside', zone: BROWN }
const outsideUnnamed: ZoneVerdict = { status: 'outside', zone: null, covered: BROWN }
const outsideBlue: ZoneVerdict = { status: 'outside', zone: 'blue zone', covered: BROWN }
const unreachable: ZoneVerdict = { status: 'unknown', reason: 'unreachable', plan: bkk.plan }
const noZone: ZoneVerdict = { status: 'unknown', reason: 'no-zone', plan: bkk.plan }

const fromSnapshot = (verdict: ZoneVerdict): SnapshotVerdict => ({ verdict, asOf: AS_OF, source: bkk })

describe('zoneCheck', () => {
  it('has nothing to say before either answer', () => {
    expect(zoneCheck(null, null)).toBeNull()
  })

  it('gives the snapshot verdict, dated, while the live layer has not answered', () => {
    const snapshot = fromSnapshot(inside)
    expect(zoneCheck(snapshot, null)).toEqual({ verdict: inside, note: { kind: 'as-of', snapshot } })
  })

  it('keeps the dated snapshot verdict when the live layer is unreachable or maps nothing there', () => {
    const snapshot = fromSnapshot(inside)
    for (const live of [unreachable, noZone]) expect(zoneCheck(snapshot, live)).toEqual({ verdict: inside, note: { kind: 'as-of', snapshot } })
  })

  it('changes nothing but the zone names when the live layer agrees, so the live layer can name the zone', () => {
    const snapshot = fromSnapshot(inside)
    expect(zoneCheck(snapshot, inside)).toEqual(zoneCheck(snapshot, null))
    const outside = fromSnapshot(outsideUnnamed)
    expect(zoneCheck(outside, outsideBlue)).toEqual({ verdict: outsideBlue, note: { kind: 'as-of', snapshot: outside } })
  })

  it('keeps the snapshot verdict and notes the difference when the live layer differs', () => {
    const snapshot = fromSnapshot(inside)
    expect(zoneCheck(snapshot, outsideBlue)).toEqual({ verdict: inside, note: { kind: 'live-differs', snapshot } })
    const outside = fromSnapshot(outsideUnnamed)
    expect(zoneCheck(outside, inside)).toEqual({ verdict: outsideUnnamed, note: { kind: 'live-differs', snapshot: outside } })
  })

  it('gives the live answer alone where there is no snapshot', () => {
    expect(zoneCheck(null, unreachable)).toEqual({ verdict: unreachable, note: null })
    expect(zoneCheck(null, inside)).toEqual({ verdict: inside, note: null })
  })
})
