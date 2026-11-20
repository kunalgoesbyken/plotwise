import { Check, CircleHelp, X } from 'lucide-react'
import type { Design } from '@/designs'
import { t } from '@/text/messages'
import { Badge } from '@/ui/badge'
import { cn } from '@/ui/cn'
import { tally } from './checklist'

export function Tally({ checks, className }: { checks: Design['checks']; className?: string }) {
  const counts = tally(checks)
  return (
    <p className={cn('flex flex-wrap gap-1.5', className)}>
      <Badge variant="secondary" className="text-primary">
        <Check aria-hidden="true" />
        {t('tally.pass', { count: counts.pass })}
      </Badge>
      {counts.fail > 0 && (
        <Badge variant="destructive">
          <X aria-hidden="true" />
          {t('tally.fail', { count: counts.fail })}
        </Badge>
      )}
      {counts.manual > 0 && (
        <Badge variant="road">
          <CircleHelp aria-hidden="true" />
          {t('tally.manual', { count: counts.manual })}
        </Badge>
      )}
    </p>
  )
}
