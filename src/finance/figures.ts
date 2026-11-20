import type { Region } from '@/region/regions'
import { t } from '@/text/messages'
import type { AreaUnit } from '@/units/area'
import { formatMoney } from './format-money'
import { totalOf, type Estimate, type Parking, type Range } from './estimate'
import { RATES, SCALARS, type RateRow, type ScalarId } from './parameters'

export const rangeText = ({ low, high }: Range, currency: string | null) =>
  t('money.range', { low: formatMoney(low, currency), high: formatMoney(high, currency) })

export const parkingText = ({ levelsAboveGround, basementLevels }: Parking) =>
  t('money.parking-levels-value', { above: levelsAboveGround, basement: basementLevels })

export const firstCostRange = ({ firstCost }: Estimate): Range => ({ low: totalOf(firstCost.low), high: totalOf(firstCost.high) })

export function scalarLabel(id: ScalarId, { areaUnit, areaTerms }: Region): string {
  if (id === 'salePrice') return t('assumptions.salePrice', { unit: t(`area-unit.${areaUnit}`), saleable: areaTerms.saleable })
  return id === 'saleableShare' ? t('assumptions.saleableShare', areaTerms) : t(`assumptions.${id}`)
}

export const everyValueLabel = (region: Region) => [
  ...(Object.keys(SCALARS) as ScalarId[]).map((id) => scalarLabel(id, region)),
  ...RATES.map(({ row }) => t('assumptions.rate-range', { row: rateLabel(row, region.areaUnit) })),
]

export const rateLabel = (row: RateRow, area: AreaUnit) =>
  row === 'basement' ? t('assumptions.rate.basement', { unit: t(`area-unit.${area}`) }) : t(`assumptions.rate.${row}`)
