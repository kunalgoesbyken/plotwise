'use client'

import type { LngLat } from '@/geo/projection'
import { t } from '@/text/messages'
import { Badge } from '@/ui/badge'
import type { ZoneVerdict } from './schema'
import { useZone } from './use-zone'

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
            <a href={plan.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
              {t('zone.confirm', { plan: plan.name })}
            </a>
          </>
        )}
      </span>
    </>
  )
}

export function ZoneStatus({ ring }: { readonly ring: readonly LngLat[] }) {
  const verdict = useZone(ring)
  return (
    <p role="status" className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm leading-relaxed">
      {verdict ? <ZoneText verdict={verdict} /> : <span className="text-muted-foreground">{t('zone.checking')}</span>}
    </p>
  )
}
