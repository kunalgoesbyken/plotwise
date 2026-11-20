'use client'

import { useId, type ReactNode } from 'react'
import type { Design } from '@/designs'
import { formatQuantity } from '@/text/format'
import { t } from '@/text/messages'
import { cn } from '@/ui/cn'
import { Disclosure } from '@/ui/disclosure'
import { Placeholder } from '@/ui/section'
import { checkRow, type CheckRow, type CheckStatus } from './checklist'
import { useFeasibility } from './feasibility-provider'
import { WhenReady } from './ready'
import { Sources } from './sources'
import { Tally } from './tally'
import { ToCheck } from './to-check'
import { yieldFigure } from './yield-figure'

const STATUS_TONE: Readonly<Record<CheckStatus, string>> = {
  pass: 'text-muted-foreground',
  fail: 'text-destructive',
  manual: 'text-road-foreground',
}

export type Row = { readonly label: string; readonly cell: (design: Design) => ReactNode }

function rowsFor([first]: readonly Design[], showChecks: (design: Design) => void): readonly Row[] {
  return [
    { label: t('metric.floor-area'), cell: (d) => formatQuantity(d.metrics.gfaSqm, 'sqm') },
    { label: t('metric.height'), cell: (d) => formatQuantity(d.metrics.heightM, 'm') },
    { label: t('metric.storeys'), cell: (d) => formatQuantity(d.metrics.storeys, 'count') },
    { label: yieldFigure(first.metrics.yield).label, cell: (d) => yieldFigure(d.metrics.yield).value },
    { label: t('metric.far'), cell: (d) => formatQuantity(d.metrics.far, 'ratio') },
    { label: t('metric.parking'), cell: (d) => formatQuantity(d.metrics.parkingSpaces, 'count') },
    { label: t('metric.open-space'), cell: (d) => formatQuantity(d.metrics.openSpaceSqm, 'sqm') },
    { label: t('metric.limited-by'), cell: (d) => t(`limiter.${d.limitedBy}`) },
    { label: t('metric.checks'), cell: (d) => <Tally checks={d.checks} onShowChecks={() => showChecks(d)} /> },
  ]
}

function CheckItem({ row }: { row: CheckRow }) {
  const failed = row.status === 'fail'
  return (
    <li className="flex gap-3 py-2.5">
      <span className={cn('w-10 shrink-0 pt-px text-xs font-semibold', STATUS_TONE[row.status])}>{t(`status.${row.status}`)}</span>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm leading-snug', failed && 'font-medium text-destructive')}>{t(`check.${row.id}`)}</p>
        <p className={cn('mt-0.5 text-xs', failed ? 'text-destructive' : 'text-muted-foreground')}>{row.reading ?? t('check.manual')}</p>
        <Sources cites={row.cites} />
      </div>
    </li>
  )
}

function DesignTable({ designs, extraRows }: { designs: readonly Design[]; extraRows: readonly Row[] }) {
  const { design: selected, selectDesign } = useFeasibility()
  const toCheckId = useId()
  if (designs.length === 0 || !selected) return <Placeholder>{t('designs.none')}</Placeholder>
  const shown = (design: Design) => design.id === selected.id
  const showChecks = (design: Design) => {
    selectDesign(design.id)
    requestAnimationFrame(() => document.getElementById(toCheckId)?.focus())
  }
  return (
    <div className="flex flex-col gap-4">
      <table aria-label={t('design.compare')} className="w-full table-fixed border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <td className="w-[28%]" />
            {designs.map((design) => {
              const name = t(design.nameKey)
              return (
                <th key={design.id} scope="col" className="p-0 align-bottom">
                  <button
                    type="button"
                    aria-pressed={shown(design)}
                    aria-label={t('design.show', { name })}
                    onClick={() => selectDesign(design.id)}
                    className="relative flex min-h-11 w-full items-end px-2 py-2 text-left text-xs leading-snug font-medium text-muted-foreground transition-colors hover:text-foreground aria-pressed:text-foreground after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-foreground after:opacity-0 after:transition-opacity aria-pressed:after:opacity-100"
                  >
                    {name}
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="divide-y">
          {[...rowsFor(designs, showChecks), ...extraRows].map(({ label, cell }) => (
            <tr key={label}>
              <th scope="row" className="py-2 pr-2 text-left text-xs font-normal text-muted-foreground">
                {label}
              </th>
              {designs.map((design) => (
                <td key={design.id} className={cn('px-2 py-2 align-top transition-colors', shown(design) ? 'text-foreground' : 'text-muted-foreground')}>
                  {cell(design)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs leading-relaxed text-muted-foreground">{t(`${selected.nameKey}.summary`)}</p>
      <ToCheck design={selected} id={toCheckId} />
      <Disclosure label={t('design.checklist', { name: t(selected.nameKey) })}>
        <ul className="divide-y">
          {selected.checks.map((check) => (
            <CheckItem key={check.id} row={checkRow(check)} />
          ))}
        </ul>
      </Disclosure>
    </div>
  )
}

export function DesignsPanel({ extraRows = [] }: { extraRows?: readonly Row[] }) {
  return <WhenReady render={({ designs }) => <DesignTable designs={designs} extraRows={extraRows} />} />
}
