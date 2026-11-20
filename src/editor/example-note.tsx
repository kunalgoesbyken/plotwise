import { t } from '@/text/messages'
import { cn } from '@/ui/cn'

export function ExampleNote({ source, className }: { readonly source: string; readonly className?: string }) {
  return (
    <p className={cn('text-xs leading-relaxed text-muted-foreground', className)}>
      <span className="font-medium text-foreground">{t('example.values')}</span> {source}
    </p>
  )
}
