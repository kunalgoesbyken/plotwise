import { WarningCircleIcon } from '@phosphor-icons/react'
import { lowRiseRow, type Solution } from '@/solve'
import { t } from '@/text/messages'
import { cn } from '@/ui/cn'
import { Sources } from './sources'

export function LowRiseNote({ solution, className }: { solution: Solution; className?: string }) {
  const { pack, landAreaSqm } = solution
  const rule = pack.lowRiseOpenSpaces
  if (!rule || !pack.sideRearOpenSpaces || !lowRiseRow(pack, landAreaSqm)) return null
  return (
    <div role="note" className={cn('flex gap-2 text-xs leading-relaxed', className)}>
      <WarningCircleIcon aria-hidden="true" weight="fill" className="mt-0.5 size-3.5 shrink-0 text-road" />
      <div className="min-w-0 text-muted-foreground">
        <p>{t('limit.side-rear.low-rise')}</p>
        <Sources cites={[rule.appliesTo]} />
      </div>
    </div>
  )
}
