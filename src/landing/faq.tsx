'use client'

import { PlusIcon } from '@phosphor-icons/react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/ui/collapsible'

export function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <Collapsible className="group/faq rounded-frame-inner bg-background">
      <CollapsibleTrigger className="flex min-h-16 w-full cursor-pointer items-center justify-between gap-6 px-6 py-4 text-left font-medium tracking-tight">
        {question}
        <PlusIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/faq:rotate-45" />
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <p className="px-6 pb-5 text-sm leading-relaxed text-muted-foreground">{answer}</p>
      </CollapsibleContent>
    </Collapsible>
  )
}
