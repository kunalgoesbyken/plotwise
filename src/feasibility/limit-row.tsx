import type { ReactNode } from 'react'
import type { Cite } from '@/rules'
import { Sources } from './sources'

type LimitRowProps = {
  readonly label: string
  readonly value?: string
  readonly detail?: ReactNode
  readonly cites: readonly Cite[]
}

export function LimitRow({ label, value, detail, cites }: LimitRowProps) {
  return (
    <li className="flex flex-col gap-0.5 py-2.5">
      <div className="flex items-baseline justify-between gap-4">
        <span className="min-w-0 text-sm">{label}</span>
        {value && <span className="shrink-0 text-right font-mono text-sm font-medium tabular-nums">{value}</span>}
      </div>
      {detail && <p className="max-w-prose text-xs leading-relaxed text-slate">{detail}</p>}
      <Sources cites={cites} />
    </li>
  )
}

type RuleSectionProps = { readonly title: string; readonly intro?: string; readonly children: ReactNode }

export function RuleSection({ title, intro, children }: RuleSectionProps) {
  return (
    <section aria-label={title} className="mt-6 first:mt-0">
      <h3 className="border-b border-rule pb-1.5 font-display text-sm font-semibold">{title}</h3>
      {intro && <p className="mt-2 max-w-prose text-xs leading-relaxed text-slate">{intro}</p>}
      {children}
    </section>
  )
}

export function LimitGroup({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <RuleSection title={title}>
      <ul className="flex flex-col divide-y divide-rule/70">{children}</ul>
    </RuleSection>
  )
}
