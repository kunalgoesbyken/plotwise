'use client'

import { useMemo } from 'react'
import { formatQuantity } from '@/text/format'
import { t } from '@/text/messages'
import { cn } from '@/ui/cn'
import { useFeasibility } from './feasibility-provider'
import { widthSensitivity, type WidthRow } from './width-sensitivity'

function OutcomeCells({ row }: { row: WidthRow }) {
  if (!row.outcome) {
    return (
      <td colSpan={2} className="py-1 text-right text-muted-foreground">
        {t('sensitivity.unavailable')}
      </td>
    )
  }
  return (
    <>
      <td className="py-1 text-right">{formatQuantity(row.outcome.gfaSqm, 'sqm')}</td>
      <td className="py-1 text-right">{formatQuantity(row.outcome.heightM, 'm')}</td>
    </>
  )
}

export function WidthSensitivity() {
  const { plot, result, farBonus } = useFeasibility()
  const ready = result?.status === 'ready'
  const rows = useMemo(() => (plot && ready ? widthSensitivity(plot, farBonus ? 'bonus' : 'standard') : null), [plot, ready, farBonus])
  if (!rows) return null
  return (
    <section aria-label={t('sensitivity.label')}>
      <p className="text-xs text-muted-foreground">{t('sensitivity.hint')}</p>
      <table className="mt-1 w-full text-left text-sm tabular-nums">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th scope="col" className="pb-1 font-normal">
              {t('sensitivity.width')}
            </th>
            <th scope="col" className="pb-1 text-right font-normal">
              {t('metric.floor-area')}
            </th>
            <th scope="col" className="pb-1 text-right font-normal">
              {t('metric.height')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.widthM} aria-current={row.current || undefined} className={cn(row.current ? 'font-semibold' : 'text-muted-foreground')}>
              <th scope="row" className="py-1 font-[inherit]">
                {formatQuantity(row.widthM, 'm')}
              </th>
              <OutcomeCells row={row} />
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
