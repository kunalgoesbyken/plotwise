import type { Design } from '@/designs'
import { t } from '@/text/messages'
import { tally } from './checklist'

export function Tally({ checks }: { checks: Design['checks'] }) {
  const counts = tally(checks)
  return (
    <p className="flex flex-wrap gap-x-3 font-mono text-xs tabular-nums">
      <span className="text-plot">{t('tally.pass', { count: counts.pass })}</span>
      <span className={counts.fail > 0 ? 'font-medium text-signal' : 'text-slate'}>{t('tally.fail', { count: counts.fail })}</span>
      <span className="text-road-ink">{t('tally.manual', { count: counts.manual })}</span>
    </p>
  )
}
