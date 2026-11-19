import type { ReactNode } from 'react'

const TONES = { plot: 'text-plot', slate: 'text-slate' } as const

type DisclosureProps = {
  readonly label: ReactNode
  readonly tone?: keyof typeof TONES
  readonly className?: string
  readonly children: ReactNode
}

export function Disclosure({ label, tone = 'plot', className = '', children }: DisclosureProps) {
  return (
    <details className={`group ${className}`}>
      <summary
        className={`inline-flex min-h-11 cursor-pointer list-none items-center gap-1 font-mono text-[11px] tracking-wide uppercase select-none lg:min-h-6 [&::-webkit-details-marker]:hidden ${TONES[tone]}`}
      >
        <span aria-hidden="true" className="inline-block transition-transform group-open:rotate-90">
          ›
        </span>
        {label}
      </summary>
      {children}
    </details>
  )
}
