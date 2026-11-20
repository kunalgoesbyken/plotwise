import type { Icon } from '@phosphor-icons/react'
import { BookOpenTextIcon, CoinsIcon, CubeIcon, WarningCircleIcon } from '@phosphor-icons/react/ssr'
import type { ReactNode } from 'react'
import type { Range } from '@/finance/estimate'
import { rangeText } from '@/finance/figures'
import { t } from '@/text/messages'
import type { exampleFigures } from './example'

type Figures = ReturnType<typeof exampleFigures>

function Card({ icon: Glyph, title, body, children }: { icon: Icon; title: string; body: string; children: ReactNode }) {
  return (
    <article className="reveal flex flex-col gap-5 rounded-frame-inner bg-background p-6 sm:p-7">
      <span className="grid size-10 place-items-center rounded-lg bg-canvas text-foreground">
        <Glyph aria-hidden="true" weight="light" className="size-5" />
      </span>
      <div>
        <h3 className="text-lg font-medium tracking-tight">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
      </div>
      <div className="dots mt-auto flex min-h-44 items-center justify-center rounded-xl border bg-canvas/40 p-5">{children}</div>
    </article>
  )
}

function SourcesPanel({ cited }: Pick<Figures, 'cited'>) {
  return (
    <ul className="w-full max-w-sm divide-y rounded-lg border bg-background text-xs shadow-xs">
      {cited.map(({ id, cite, source }) => (
        <li key={id} className="flex flex-col gap-0.5 px-4 py-2.5">
          <span className="font-medium">{t(`check.${id}`)}</span>
          <span className="text-muted-foreground">
            {source} · {t('source.location', { page: cite.page, line: cite.line })}
          </span>
        </li>
      ))}
    </ul>
  )
}

const GROUND_Y = 96
const TIERS = [
  { x: 28, width: 104, height: 18 },
  { x: 48, width: 80, height: 26 },
  { x: 74, width: 50, height: 28 },
] as const

function EnvelopePanel() {
  const tops = TIERS.map((_, index) => GROUND_Y - TIERS.slice(0, index + 1).reduce((sum, tier) => sum + tier.height, 0))
  return (
    <svg viewBox="0 0 160 110" aria-hidden="true" className="h-36 text-foreground">
      <path d="M20 96 V74 L140 16 V96" fill="none" stroke="var(--color-plot)" strokeDasharray="3 3" strokeWidth="1.2" />
      <line x1="2" y1={GROUND_Y} x2="158" y2={GROUND_Y} stroke="var(--color-border)" strokeWidth="1.2" />
      <line x1="2" y1={GROUND_Y} x2="20" y2={GROUND_Y} stroke="var(--color-road)" strokeWidth="4" strokeLinecap="round" />
      {TIERS.map(({ x, width, height }, index) => (
        <rect
          key={x}
          x={x}
          y={tops[index]}
          width={width}
          height={height}
          rx="1.5"
          fill="var(--color-background)"
          stroke="currentColor"
          strokeWidth="1.2"
          className="animate-enter"
          style={{ animationDelay: `${index * 120}ms` }}
        />
      ))}
    </svg>
  )
}

function CheckPanel({ toCheck }: Pick<Figures, 'toCheck'>) {
  if (toCheck.length === 0) return <p className="text-sm text-muted-foreground">{t('landing.check.none')}</p>
  return (
    <ul className="w-full max-w-sm divide-y rounded-lg border bg-background text-xs shadow-xs">
      {toCheck.map((id) => (
        <li key={id} className="flex items-center gap-3 px-4 py-2.5">
          <span className="w-10 shrink-0 font-semibold text-road-foreground">{t('status.manual')}</span>
          <span className="font-medium">{t(`check.${id}`)}</span>
        </li>
      ))}
    </ul>
  )
}

function RangeBar({ label, range, scale, currency }: { label: string; range: Range; scale: number; currency: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between gap-4 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{rangeText(range, currency)}</span>
      </div>
      <div className="relative h-2 rounded-full bg-muted">
        <span
          className="absolute inset-y-0 rounded-full bg-foreground"
          style={{ left: `${(range.low / scale) * 100}%`, right: `${100 - (range.high / scale) * 100}%` }}
        />
      </div>
    </div>
  )
}

function MoneyPanel({ firstCost, landValue, currency }: Pick<Figures, 'firstCost' | 'landValue' | 'currency'>) {
  const scale = Math.max(firstCost.high, landValue.high)
  return (
    <div className="flex w-full max-w-sm flex-col gap-4 rounded-lg border bg-background p-4 shadow-xs">
      <RangeBar label={t('landing.money.cost')} range={firstCost} scale={scale} currency={currency} />
      <RangeBar label={t('landing.money.land')} range={landValue} scale={scale} currency={currency} />
      <p className="text-2xs text-muted-foreground">{t('money.estimated')}</p>
    </div>
  )
}

export function FeatureCards({ figures }: { figures: Figures }) {
  return (
    <div className="grid gap-2 rounded-frame bg-canvas-edge p-2 md:grid-cols-2">
      <Card icon={BookOpenTextIcon} title={t('landing.sources.title')} body={t('landing.sources.body')}>
        <SourcesPanel cited={figures.cited} />
      </Card>
      <Card icon={CubeIcon} title={t('landing.envelope.title')} body={t('landing.envelope.body')}>
        <EnvelopePanel />
      </Card>
      <Card icon={WarningCircleIcon} title={t('landing.check.title')} body={t('landing.check.body')}>
        <CheckPanel toCheck={figures.toCheck} />
      </Card>
      <Card icon={CoinsIcon} title={t('landing.money.title')} body={t('landing.money.body')}>
        <MoneyPanel firstCost={figures.firstCost} landValue={figures.landValue} currency={figures.currency} />
      </Card>
    </div>
  )
}
