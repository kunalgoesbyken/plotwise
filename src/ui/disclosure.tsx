'use client'

import { CaretRightIcon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { cn } from './cn'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './collapsible'

const TONES = { primary: 'text-foreground', muted: 'text-muted-foreground hover:text-foreground' } as const

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
        <CaretRightIcon aria-hidden="true" weight="bold" className="size-3.5 transition-transform group-data-[state=open]/disclosure:rotate-90" />
        {label}
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">{children}</CollapsibleContent>
    </Collapsible>
  )
}
