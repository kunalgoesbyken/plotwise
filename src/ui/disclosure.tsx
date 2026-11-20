'use client'

import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from './cn'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './collapsible'

const TONES = { primary: 'text-primary', muted: 'text-muted-foreground hover:text-foreground' } as const

type DisclosureProps = {
  readonly label: ReactNode
  readonly tone?: keyof typeof TONES
  readonly className?: string
  readonly children: ReactNode
}

export function Disclosure({ label, tone = 'primary', className, children }: DisclosureProps) {
  return (
    <Collapsible className={cn('group/disclosure', className)}>
      <CollapsibleTrigger
        className={cn('inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-sm text-xs font-medium transition-colors lg:min-h-7', TONES[tone])}
      >
        <ChevronRight aria-hidden="true" className="size-3.5 transition-transform duration-150 group-data-[state=open]/disclosure:rotate-90" />
        {label}
      </CollapsibleTrigger>
      <CollapsibleContent>{children}</CollapsibleContent>
    </Collapsible>
  )
}
