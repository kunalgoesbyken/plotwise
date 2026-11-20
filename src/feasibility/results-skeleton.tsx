import { t } from '@/text/messages'
import { Skeleton } from '@/ui/skeleton'

const ROWS = 7

export function ResultsSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-3">
      <span className="sr-only">{t('feasibility.working')}</span>
      <Skeleton className="h-11 w-full" />
      {Array.from({ length: ROWS }, (_, row) => (
        <Skeleton key={row} className="h-6 w-full" />
      ))}
    </div>
  )
}

export function SummarySkeleton() {
  return (
    <div role="status" className="flex flex-col gap-2">
      <span className="sr-only">{t('feasibility.working')}</span>
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-full" />
    </div>
  )
}
