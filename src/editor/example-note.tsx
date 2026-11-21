import { t } from '@/text/messages'
import { cn } from '@/ui/cn'
import { Disclosure } from '@/ui/disclosure'

export function ExampleNote({ source, className }: { readonly source: string; readonly className?: string }) {
  return (
    <div className={cn('text-xs', className)}>
      <p className="font-medium text-foreground">{t('example.values')}</p>
      <Disclosure label={t('assumptions.source')} tone="muted">
        <p className="pb-2 leading-relaxed text-muted-foreground">{source}</p>
      </Disclosure>
    </div>
  )
}
