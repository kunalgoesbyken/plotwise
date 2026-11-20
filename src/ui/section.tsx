import type { ReactNode } from 'react'
import { cn } from './cn'

type SectionProps = {
  readonly title: string
  readonly aside?: ReactNode
  readonly description?: ReactNode
  readonly className?: string
  readonly children: ReactNode
}

export function PanelSection({ title, aside, description, className, children }: SectionProps) {
  return (
    <section aria-label={title} className={cn('border-t px-(--pad) py-5 first:border-t-0', className)}>
      <header className="mb-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base leading-6 font-semibold">{title}</h2>
          {aside && <span className="text-xs text-muted-foreground">{aside}</span>}
        </div>
        {description && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </header>
      {children}
    </section>
  )
}

export function Placeholder({ children }: { readonly children: ReactNode }) {
  return <p className="rounded-lg border border-dashed px-4 py-3 text-sm leading-relaxed text-muted-foreground">{children}</p>
}
