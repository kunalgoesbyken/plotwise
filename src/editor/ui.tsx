import type { ButtonHTMLAttributes, ReactNode } from 'react'

const TONES = {
  primary: 'bg-plot text-paper hover:bg-ink',
  quiet: 'border border-rule bg-paper text-ink hover:border-ink',
  danger: 'border border-rule bg-paper text-signal hover:border-signal',
  inverse: 'bg-paper/10 text-paper hover:bg-paper/20',
} as const

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { tone?: keyof typeof TONES }

export function Button({ tone = 'quiet', className = '', ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors disabled:opacity-40 lg:min-h-9 ${TONES[tone]} ${className}`}
      {...props}
    />
  )
}

export function Click() {
  return (
    <>
      <span className="pointer-coarse:hidden">Click</span>
      <span className="hidden pointer-coarse:inline">Tap</span>
    </>
  )
}

type SectionProps = { title: string; aside?: ReactNode; className?: string; children: ReactNode }

export function PanelSection({ title, aside, className = '', children }: SectionProps) {
  return (
    <section className={`border-b border-rule px-4 py-4 last:border-b-0 lg:px-5 ${className}`} aria-label={title}>
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xs font-semibold tracking-[0.12em] text-slate uppercase">{title}</h2>
        {aside && <span className="font-mono text-xs text-slate">{aside}</span>}
      </header>
      {children}
    </section>
  )
}

export function Placeholder({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-relaxed text-slate">{children}</p>
}
