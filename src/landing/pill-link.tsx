import { ArrowRightIcon } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/ui/cn'

const BASE = 'group inline-flex h-12 items-center rounded-full text-base font-medium tracking-tight transition-colors'

export function PillLink({ href, children, quiet = false }: { href: string; children: ReactNode; quiet?: boolean }) {
  if (quiet) {
    return (
      <Link href={href} className={cn(BASE, 'border border-foreground/80 px-6 hover:bg-foreground hover:text-background')}>
        {children}
      </Link>
    )
  }
  return (
    <Link href={href} className={cn(BASE, 'gap-3 bg-foreground pr-1.5 pl-6 text-background hover:bg-foreground/85')}>
      {children}
      <span className="grid size-9 place-items-center rounded-full bg-background text-foreground transition-transform group-hover:translate-x-0.5">
        <ArrowRightIcon aria-hidden="true" weight="bold" className="size-4" />
      </span>
    </Link>
  )
}
