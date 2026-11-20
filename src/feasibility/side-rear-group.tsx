import { useRegion } from '@/editor/plot-store'
import type { SideRearRow } from '@/rules'
import { negate, rowCites, type SideRearLimit } from '@/solve'
import { formatBound, formatQuantity, formatRange } from '@/text/format'
import { t } from '@/text/messages'
import { LimitGroup, LimitRow } from './limit-row'

function distanceText({ distance }: SideRearRow): string {
  if (distance.kind === 'fixed') return formatQuantity(distance.distanceM.value, 'm')
  const metres = (cited: typeof distance.minM) => cited && formatQuantity(cited.value, 'm')
  return t('value.side-rear.share', { divisor: formatQuantity(1 / distance.share.value, 'ratio'), min: metres(distance.minM), max: metres(distance.maxM) })
}

function ColumnRow({ limit }: { limit: SideRearLimit }) {
  const { areaUnit } = useRegion()
  const { areaSqm, averageWidthOrDepthM } = limit.smallPlot
  const small = limit.plotClass === 'small'
  const shown = (bound: typeof areaSqm) => (small ? bound : { cmp: negate(bound.cmp), value: bound.value })
  return (
    <LimitRow
      label={t('limit.side-rear.column')}
      value={t(`limit.side-rear.class.${limit.plotClass}`)}
      detail={t(`limit.side-rear.column.${limit.plotClass}`, { area: formatBound(shown(areaSqm), areaUnit), width: formatBound(shown(averageWidthOrDepthM), 'm') })}
      cites={[limit.appliesTo, areaSqm.cite, averageWidthOrDepthM.cite]}
    />
  )
}

export function SideRearGroup({ limit }: { limit: SideRearLimit | null }) {
  if (!limit) return null
  return (
    <LimitGroup title={t('rules.group.side-rear')}>
      <ColumnRow limit={limit} />
      {limit.rows.map((row, i) => (
        <LimitRow
          key={i}
          label={t('limit.side-rear.row', { height: formatRange(row.heightM, 'm') })}
          value={distanceText(row)}
          cites={[limit.appliesTo, ...rowCites(row)]}
        />
      ))}
    </LimitGroup>
  )
}
