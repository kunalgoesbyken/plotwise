'use client'

import { Switch as SwitchPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'
import { cn } from './cn'

export function SwitchRow({ className, children, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'group/switch flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-md text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 lg:min-h-9',
        className,
      )}
      {...props}
    >
      <span className="inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-input p-0.5 transition-colors group-data-[state=checked]/switch:bg-foreground">
        <SwitchPrimitive.Thumb className="block size-4 rounded-full bg-background shadow-xs transition-transform data-[state=checked]:translate-x-4" />
      </span>
      <span className="min-w-0">{children}</span>
    </SwitchPrimitive.Root>
  )
}
