import type { Design } from '@/designs'
import { t } from '@/text/messages'
import { cn } from '@/ui/cn'
import { tally } from './checklist'

export function Tally({ checks, className }: { checks: Design['checks']; className?: string }) {
  const counts = tally(checks)
  return (
    <span className={cn('flex flex-col text-xs leading-snug', className)}>
      <span className="text-primary">{t('tally.pass', { count: counts.pass })}</span>
      {counts.fail > 0 && <span className="font-medium text-destructive">{t('tally.fail', { count: counts.fail })}</span>}
      {counts.manual > 0 && <span className="text-road-foreground">{t('tally.manual', { count: counts.manual })}</span>}
    </span>
  )
}
