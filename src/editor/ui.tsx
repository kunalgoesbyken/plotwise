import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { t } from '@/text/messages'

const TONES = {
  primary: 'bg-plot text-paper hover:bg-ink',
  quiet: 'border border-rule bg-paper text-ink hover:border-slate hover:bg-vellum/60',
  danger: 'border border-rule bg-paper text-signal hover:border-signal hover:bg-signal/5',
  inverse: 'bg-paper/10 text-paper hover:bg-paper/20 focus-visible:outline-paper',
} as const

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { tone?: keyof typeof TONES }

export function Button({ tone = 'quiet', className = '', ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex h-11 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,translate] duration-150 ease-out-quart active:translate-y-px disabled:pointer-events-none disabled:opacity-40 lg:h-9 ${TONES[tone]} ${className}`}
      {...props}
    />
  )
}

export const SEGMENTS = 'grid gap-1 rounded-lg bg-vellum p-1'

export const SEGMENT = [
  'flex h-11 items-center justify-center gap-1.5 rounded-md px-2 text-center leading-tight font-medium text-slate transition-colors duration-150 hover:text-ink lg:h-9',
  'aria-pressed:bg-paper aria-pressed:text-ink aria-pressed:shadow-sm aria-pressed:ring-1 aria-pressed:ring-ink/5',
  'has-checked:bg-paper has-checked:text-ink has-checked:shadow-sm has-checked:ring-1 has-checked:ring-ink/5',
].join(' ')

export function PointerText({ text }: { text: (verb: string) => string }) {
  return (
    <>
      <span className="pointer-coarse:hidden">{text(t('verb.click'))}</span>
      <span className="hidden pointer-coarse:inline">{text(t('verb.tap'))}</span>
    </>
  )
}

type SectionProps = { title: string; aside?: ReactNode; className?: string; children: ReactNode }

export function PanelSection({ title, aside, className = '', children }: SectionProps) {
  return (
    <section className={`border-t border-rule px-(--pad) py-5 first:border-t-0 ${className}`} aria-label={title}>
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-base leading-6 font-semibold text-ink">{title}</h2>
        {aside && <span className="font-mono text-xs text-slate tabular-nums">{aside}</span>}
      </header>
      {children}
    </section>
  )
}

export function Placeholder({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-rule px-4 py-3 text-sm leading-relaxed text-slate">{children}</p>
}

export function Note({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div role="note" className="rounded-lg border border-road/50 bg-road/10 px-3.5 py-3">
      {title && <p className="mb-1 font-display text-sm font-semibold text-road-ink">{title}</p>}
      <div className="text-xs leading-relaxed text-ink">{children}</div>
    </div>
  )
}

export function EstimateTag() {
  return (
    <span aria-hidden="true" className="rounded-sm bg-road/20 px-1.5 font-mono text-2xs font-medium text-road-ink">
      {t('frontage.estimated-tag')}
    </span>
  )
}
