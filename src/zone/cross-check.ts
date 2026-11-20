import type { ZoneSource } from './sources'
import type { ZoneVerdict } from './verdict'

export type SnapshotVerdict = { readonly verdict: ZoneVerdict; readonly asOf: string; readonly source: ZoneSource }

export type ZoneNote = { readonly kind: 'as-of' | 'live-differs'; readonly snapshot: SnapshotVerdict }

export type ZoneCheck = { readonly verdict: ZoneVerdict; readonly note: ZoneNote | null }

export function zoneCheck(snapshot: SnapshotVerdict | null, live: ZoneVerdict | null): ZoneCheck | null {
  if (!snapshot) return live && { verdict: live, note: null }
  if (!live || live.status === 'unknown') return { verdict: snapshot.verdict, note: { kind: 'as-of', snapshot } }
  if (live.status === snapshot.verdict.status) return { verdict: live, note: null }
  return { verdict: live, note: { kind: 'live-differs', snapshot } }
}
