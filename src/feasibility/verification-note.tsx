'use client'

import { WarningCircleIcon } from '@phosphor-icons/react'
import { useRegion } from '@/editor/plot-store'
import type { Solution } from '@/solve'
import { t } from '@/text/messages'
import { cn } from '@/ui/cn'

type VerificationNoteProps = { readonly solution: Solution; readonly detailed?: boolean; readonly className?: string }

export function VerificationNote({ solution, detailed = false, className }: VerificationNoteProps) {
  const { rules } = useRegion()
  if (solution.verification === 'verified') return null
  return (
    <div role="note" data-verification="unverified" className={cn('flex gap-2 text-xs leading-relaxed', className)}>
      <WarningCircleIcon aria-hidden="true" weight="fill" className="mt-0.5 size-3.5 shrink-0 text-road" />
      <p>
        <strong className="font-semibold text-foreground">{t(`verification.${rules}`)}</strong>
        {detailed && <span className="text-muted-foreground"> {t('verification.detail')}</span>}
      </p>
    </div>
  )
}
