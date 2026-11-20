'use client'

import { formatDate } from '@/text/format'
import { t } from '@/text/messages'
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import type { ZoneCheck, ZoneNote } from './cross-check'
import type { Link } from './sources'
import type { ZonePart, ZoneVerdict } from './verdict'
import { useZoneGate } from './zone-gate'

type Presentation = { readonly badge: string; readonly variant: 'default' | 'destructive' | 'secondary'; readonly text: string }

const partName = (zone: string | null) => zone ?? t('zone.part.unnamed')

const formatParts = (parts: readonly ZonePart[]) =>
  parts.length === 1 ? partName(parts[0].zone) : parts.map(({ zone, share }) => `${partName(zone)} (${Math.round(share * 100)}%)`).join(', ')

function presentationOf(verdict: ZoneVerdict, confirmedZone: string | null): Presentation {
  switch (verdict.status) {
    case 'inside':
      return { badge: t('zone.badge.covered'), variant: 'default', text: t('zone.inside', { zone: verdict.zone }) }
    case 'outside':
      return {
        badge: t('zone.badge.not-covered'),
        variant: 'destructive',
        text: verdict.zone === null ? t('zone.outside.unnamed', { covered: verdict.covered }) : t('zone.outside', { zone: verdict.zone, covered: verdict.covered }),
      }
    case 'straddles':
      return {
        badge: t('zone.badge.not-covered'),
        variant: 'destructive',
        text: t('zone.straddles', { parts: formatParts(verdict.parts), covered: verdict.covered }),
      }
    case 'unknown':
      return confirmedZone === null
        ? { badge: t('zone.badge.unchecked'), variant: 'secondary', text: t(`zone.unknown.${verdict.reason}`) }
        : { badge: t('zone.badge.confirmed'), variant: 'secondary', text: t('zone.confirmed', { zone: confirmedZone }) }
  }
}

function PlanLink({ plan }: { plan: Link }) {
  return (
    <>
      {' '}
      <a href={plan.url} target="_blank" rel="noreferrer" className="underline decoration-foreground/25 underline-offset-3 transition-colors hover:decoration-foreground">
        {t('zone.confirm', { plan: plan.name })}
      </a>
    </>
  )
}

function Note({ note }: { note: ZoneNote }) {
  const { asOf, source } = note.snapshot
  const words = { layer: source.layer.name, date: formatDate(asOf) }
  if (note.kind === 'as-of') return <span className="text-muted-foreground">{t('zone.as-of', words)}</span>
  return (
    <span>
      {t('zone.live-differs', words)}
      <PlanLink plan={source.plan} />
    </span>
  )
}

function ZoneText({ check: { verdict, note }, confirmedZone }: { check: ZoneCheck; confirmedZone: string | null }) {
  const { badge, variant, text } = presentationOf(verdict, confirmedZone)
  const plan = verdict.status === 'unknown' && confirmedZone === null ? verdict.plan : null
  return (
    <>
      <Badge variant={variant}>{badge}</Badge>
      <span>
        {text}
        {plan && <PlanLink plan={plan} />}
      </span>
      {note && <Note note={note} />}
    </>
  )
}

export function ZoneStatus() {
  const { zone, check, confirmed } = useZoneGate()
  if (!zone) return null
  return (
    <p aria-live="polite" className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs leading-relaxed">
      {check ? <ZoneText check={check} confirmedZone={confirmed ? zone : null} /> : <span className="text-muted-foreground">{t('zone.checking')}</span>}
    </p>
  )
}

export function ZoneHold() {
  const { zone, check, confirmable, confirm } = useZoneGate()
  return (
    <section aria-label={t('zone.hold.label')} className="flex flex-col gap-3">
      <ZoneStatus />
      {check && <p className="text-sm leading-snug">{confirmable && zone ? t('zone.hold.confirmable', { zone }) : t('zone.hold.refused')}</p>}
      {confirmable && (
        <Button size="sm" variant="outline" className="self-start" onClick={confirm}>
          {t('zone.hold.confirm')}
        </Button>
      )}
    </section>
  )
}

export function ZoneHeld() {
  return <p className="text-sm text-muted-foreground">{t('zone.hold.panel')}</p>
}
