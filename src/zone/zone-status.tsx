'use client'

import { t } from '@/text/messages'
import { Badge } from '@/ui/badge'
import { Button } from '@/ui/button'
import type { ZoneVerdict } from './schema'
import { useZoneGate } from './zone-gate'

type Presentation = { readonly badge: string; readonly variant: 'default' | 'destructive' | 'secondary'; readonly text: string }

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
    case 'mixed':
      return {
        badge: t('zone.badge.not-covered'),
        variant: 'destructive',
        text: t('zone.mixed', { zones: verdict.zones.join(', '), covered: verdict.covered }),
      }
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
  const { zone, confirmable, confirm } = useZoneGate()
  return (
    <section aria-label={t('zone.hold.label')} className="flex flex-col gap-3">
      <ZoneStatus />
      <p className="text-sm leading-snug">{confirmable && zone ? t('zone.hold.confirmable', { zone }) : t('zone.hold.refused')}</p>
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
