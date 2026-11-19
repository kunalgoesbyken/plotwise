import type { ReactNode } from 'react'

const TONES = { plot: 'text-plot', slate: 'text-slate hover:text-ink' } as const

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
        className={`inline-flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-sm text-xs font-medium transition-colors select-none lg:min-h-7 [&::-webkit-details-marker]:hidden ${TONES[tone]}`}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5 transition-transform duration-150 ease-out-quart group-open:rotate-90">
          <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {label}
      </summary>
      {children}
    </details>
  )
}
