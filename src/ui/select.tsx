import * as React from 'react'
import { cn } from '@/ui/cn'

function Select({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      data-slot="select"
      className={cn(
        'h-11 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none lg:h-9 md:text-sm dark:bg-input/30',
        'focus-visible:border-foreground/50 focus-visible:ring-2 focus-visible:ring-foreground/5',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Select }
