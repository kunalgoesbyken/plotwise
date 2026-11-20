'use client'

import { WarningCircleIcon } from '@phosphor-icons/react'
import { useRegion } from '@/editor/plot-store'
import type { Region } from '@/region/regions'
import type { Solution } from '@/solve'
import { t } from '@/text/messages'
import { cn } from '@/ui/cn'

type VerificationNoteProps = { readonly solution: Solution; readonly detailed?: boolean; readonly className?: string }

function labels({ rules, cityPlan, authority }: Region): { readonly label: string; readonly detail: string } {
  if (rules === 'draftPack' && cityPlan) {
    return { label: t('verification.draftPack', { plan: cityPlan.version }), detail: t('verification.detail.draftPack', { authority }) }
  }
  return { label: t(`verification.${rules === 'draftPack' ? 'pack' : rules}`), detail: t('verification.detail') }
}

export function VerificationNote({ solution, detailed = false, className }: VerificationNoteProps) {
  const region = useRegion()
  if (solution.verification === 'verified') return null
  const { label, detail } = labels(region)
  return (
    <div role="note" data-verification={region.rules === 'draftPack' ? 'draft' : 'unverified'} className={cn('flex gap-2 text-xs leading-relaxed', className)}>
      <WarningCircleIcon aria-hidden="true" weight="fill" className="mt-0.5 size-3.5 shrink-0 text-road" />
      <p>
        <strong className="font-semibold text-foreground">{label}</strong>
        {detailed && <span className="text-muted-foreground"> {detail}</span>}
      </p>
    </div>
  )
}
