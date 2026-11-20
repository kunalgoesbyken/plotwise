import type { Design } from '@/designs'
import { t } from '@/text/messages'
import { cn } from '@/ui/cn'
import { tally } from './checklist'

type TallyProps = { checks: Design['checks']; onShowChecks: () => void; className?: string }

export function Tally({ checks, onShowChecks, className }: TallyProps) {
  const counts = tally(checks)
  return (
    <span className={cn('flex flex-col text-xs leading-snug', className)}>
      <span className="text-primary">{t('tally.pass', { count: counts.pass })}</span>
      {counts.fail > 0 && <span className="font-medium text-destructive">{t('tally.fail', { count: counts.fail })}</span>}
      {counts.manual > 0 && (
        <button
          type="button"
          onClick={onShowChecks}
          className="min-h-11 w-fit text-left text-road-foreground underline decoration-road underline-offset-2 hover:decoration-2 lg:min-h-0"
        >
          {t('tally.manual', { count: counts.manual })}
        </button>
      )}
    </span>
  )
}
