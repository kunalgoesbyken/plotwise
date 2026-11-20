'use client'

import { Box } from 'lucide-react'
import type { Design, Limiter, Metrics } from '@/designs'
import type { Limits } from '@/solve'
import { formatQuantity } from '@/text/format'
import { t } from '@/text/messages'
import { Button } from '@/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/ui/card'
import { cn } from '@/ui/cn'
import { Disclosure } from '@/ui/disclosure'
import { Progress } from '@/ui/progress'
import { Placeholder } from '@/ui/section'
import { checkRow, type CheckRow, type CheckStatus } from './checklist'
import { useFeasibility } from './feasibility-provider'
import { limiterText } from './limiter-text'
import { WhenReady } from './ready'
import { Sources } from './sources'
import { Tally } from './tally'
import { yieldFigure, type Figure } from './yield-figure'

const STATUS_STYLE: Readonly<Record<CheckStatus, { mark: string; tone: string }>> = {
  pass: { mark: '✓', tone: 'bg-accent text-primary' },
  fail: { mark: '✕', tone: 'bg-destructive text-white' },
  manual: { mark: '?', tone: 'bg-road/20 text-road-foreground' },
}

function Metric({ label, value }: Figure) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  )
}

function FloorAreaBar({ metrics, limitedBy, limits }: { metrics: Metrics; limitedBy: Limiter; limits: Limits }) {
  const share = Math.min(1, metrics.gfaSqm / limits.far.maxGfaSqm)
  return (
    <div>
      <p className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="text-lg font-semibold">{formatQuantity(metrics.gfaSqm, 'sqm')}</span>
        <span className="text-xs text-muted-foreground">{t('metric.gfa-of-max', { max: formatQuantity(limits.far.maxGfaSqm, 'sqm') })}</span>
      </p>
      <Progress value={share * 100} aria-hidden="true" className="mt-1.5 h-1.5" />
      <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{limiterText(limitedBy, limits)}</p>
    </div>
  )
}

function CheckItem({ row }: { row: CheckRow }) {
  const { mark, tone } = STATUS_STYLE[row.status]
  const failed = row.status === 'fail'
  return (
    <li className="flex gap-3 py-2.5">
      <span className={`mt-px grid size-5 shrink-0 place-items-center rounded-full text-2xs font-medium ${tone}`}>
        <span aria-hidden="true">{mark}</span>
        <span className="sr-only">{t(`status.${row.status}`)}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm leading-snug', failed && 'font-medium text-destructive')}>{t(`check.${row.id}`)}</p>
        <p className={cn('mt-0.5 text-xs', failed ? 'text-destructive' : 'text-muted-foreground')}>{row.reading ?? t('check.manual')}</p>
        <Sources cites={row.cites} />
      </div>
    </li>
  )
}

type DesignCardProps = { design: Design; limits: Limits; selected: boolean; onSelect: () => void }

function DesignCard({ design, limits, selected, onSelect }: DesignCardProps) {
  const { metrics } = design
  const name = t(design.nameKey)
  return (
    <li aria-label={name}>
      <Card className={cn('@container gap-4 py-4 transition-[border-color,box-shadow]', selected && 'border-primary shadow-[0_0_0_1px_var(--color-primary)]')}>
        <CardHeader className="px-4">
          <CardTitle>
            <h3 className="text-base leading-snug font-semibold">{name}</h3>
          </CardTitle>
          <CardDescription className="text-xs leading-relaxed">{t(`${design.nameKey}.summary`)}</CardDescription>
          <CardAction>
            <Button variant={selected ? 'default' : 'outline'} size="sm" aria-pressed={selected} aria-label={t('design.show', { name })} onClick={onSelect}>
              <Box aria-hidden="true" />
              {t(selected ? 'design.shown' : 'design.view')}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 px-4">
          <FloorAreaBar metrics={metrics} limitedBy={design.limitedBy} limits={limits} />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 @[17rem]:grid-cols-3">
            <Metric label={t('metric.far')} value={formatQuantity(metrics.far, 'ratio')} />
            <Metric label={t('metric.height')} value={formatQuantity(metrics.heightM, 'm')} />
            <Metric label={t('metric.storeys')} value={formatQuantity(metrics.storeys, 'count')} />
            <Metric {...yieldFigure(metrics.yield)} />
            <Metric label={t('metric.parking')} value={t('metric.spaces', { count: formatQuantity(metrics.parkingSpaces, 'count') })} />
            <Metric label={t('metric.open-space')} value={formatQuantity(metrics.openSpaceSqm, 'sqm')} />
          </dl>
        </CardContent>
        <CardFooter className="flex-col items-start gap-1 border-t px-4 pt-3 [.border-t]:pt-3">
          <Tally checks={design.checks} />
          <Disclosure label={t('design.checklist')}>
            <ul className="divide-y">
              {design.checks.map((check) => (
                <CheckItem key={check.id} row={checkRow(check)} />
              ))}
            </ul>
          </Disclosure>
        </CardFooter>
      </Card>
    </li>
  )
}

function DesignList({ designs, limits }: { designs: readonly Design[]; limits: Limits }) {
  const { design: selected, selectDesign } = useFeasibility()
  if (designs.length === 0) return <Placeholder>{t('designs.none')}</Placeholder>
  return (
    <ul aria-label={t('tab.designs')} className="flex flex-col gap-3">
      {designs.map((design) => (
        <DesignCard key={design.id} design={design} limits={limits} selected={design.id === selected?.id} onSelect={() => selectDesign(design.id)} />
      ))}
    </ul>
  )
}

export function DesignsPanel() {
  return <WhenReady render={({ solution, designs }) => <DesignList designs={designs} limits={solution.limits} />} />
}
