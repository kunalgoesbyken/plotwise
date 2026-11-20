'use client'

import { REGION } from '@/region/regions'
import { t } from '@/text/messages'
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import type { ZonePart, ZoneVerdict } from './verdict'
import { useZoneGate } from './zone-gate'

type Presentation = { readonly badge: string; readonly variant: 'default' | 'destructive' | 'secondary'; readonly text: string }

const formatParts = (parts: readonly ZonePart[]) =>
  parts.length === 1 ? parts[0].zone : parts.map(({ zone, share }) => `${zone} (${Math.round(share * 100)}%)`).join(', ')

function presentationOf(verdict: ZoneVerdict): Presentation {
  switch (verdict.status) {
    case 'inside':
      return { badge: t('zone.badge.covered'), variant: 'default', text: t('zone.inside', { zone: verdict.zone }) }
    case 'outside':
      return {
        badge: t('zone.badge.not-covered'),
        variant: 'destructive',
        text: t('zone.outside', { zone: verdict.zone, covered: verdict.covered }),
      }
    case 'straddles':
      return {
        badge: t('zone.badge.not-covered'),
        variant: 'destructive',
        text: t('zone.straddles', { parts: formatParts(verdict.parts), covered: verdict.covered }),
      }
    case 'unsupported':
      return { badge: t('zone.badge.not-covered'), variant: 'destructive', text: t('zone.unsupported', { parts: formatParts(verdict.parts) }) }
    case 'unknown':
      return { badge: t('zone.badge.unchecked'), variant: 'secondary', text: t(`zone.unknown.${verdict.reason}`) }
  }
}

function ZoneText({ verdict }: { verdict: ZoneVerdict }) {
  const { badge, variant, text } = presentationOf(verdict)
  const plan = verdict.status === 'unknown' ? verdict.plan : null
  return (
    <>
      <Badge variant={variant}>{badge}</Badge>
      <span>
        {text}
        {plan && (
          <>
            {' '}
            <a href={plan.url} target="_blank" rel="noreferrer" className="underline decoration-foreground/25 underline-offset-3 transition-colors hover:decoration-foreground">
              {t('zone.confirm', { plan: plan.name })}
            </a>
          </>
        )}
      </span>
    </>
  )
}

export function ZoneStatus() {
  const { verdict } = useZoneGate()
  return (
    <p aria-live="polite" className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs leading-relaxed">
      {verdict ? <ZoneText verdict={verdict} /> : <span className="text-muted-foreground">{t('zone.checking')}</span>}
    </p>
  )
}

export function ZoneHold() {
  const { verdict, confirmable, confirm } = useZoneGate()
  const refusal = verdict?.status === 'unsupported' ? t('zone.hold.unsupported') : t('zone.hold.refused')
  return (
    <section aria-label={t('zone.hold.label')} className="flex flex-col gap-3">
      <ZoneStatus />
      <p className="text-sm leading-snug">{confirmable ? t('zone.hold.confirmable', { zone: REGION.zone.name }) : refusal}</p>
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
