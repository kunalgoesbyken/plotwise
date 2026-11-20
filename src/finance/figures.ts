import type { Region } from '@/region/regions'
import { t } from '@/text/messages'
import type { AreaUnit } from '@/units/area'
import { formatMoney } from './format-money'
import { totalOf, type Estimate, type Parking, type Range } from './estimate'
import { SCALARS, type PurchasePriceId, type RateRow, type ScalarId } from './parameters'
import type { Finance } from './use-finance'

export const rangeText = ({ low, high }: Range, currency: string | null) =>
  t('money.range', { low: formatMoney(low, currency), high: formatMoney(high, currency) })

export const parkingText = ({ levelsAboveGround, basementLevels }: Parking) =>
  t('money.parking-levels-value', { above: levelsAboveGround, basement: basementLevels })

export const firstCostRange = ({ firstCost }: Estimate): Range => ({ low: totalOf(firstCost.low), high: totalOf(firstCost.high) })

export function scalarLabel(id: ScalarId, { areaUnit, areaTerms }: Region): string {
  if (id === 'salePrice') return t('assumptions.salePrice', { unit: t(`area-unit.${areaUnit}`), saleable: areaTerms.saleable })
  return id === 'saleableShare' ? t('assumptions.saleableShare', areaTerms) : t(`assumptions.${id}`)
}

export const purchasePriceLabel = (id: PurchasePriceId, { areaUnit, areaTerms }: Region) =>
  id === 'landRate' ? t('land.landRate', { rate: areaTerms.landRate, unit: t(`area-unit.${areaUnit}`) }) : t('land.tdrPrice', { unit: t(`area-unit.${areaUnit}`) })

type RateRows = Pick<Finance, 'rates' | 'buildClasses'>

export const everyValueLabel = (region: Region, finance: RateRows) => [
  ...(Object.keys(SCALARS) as ScalarId[]).map((id) => scalarLabel(id, region)),
  ...finance.rates.map(({ row }) => t('assumptions.rate-range', { row: rateLabel(row, region.areaUnit, finance) })),
]

type OneClassRow = Extract<RateRow, 'substructure.lowRise' | 'superstructure.lowRise'>

const isOneClassRow = (row: RateRow): row is OneClassRow => row === 'substructure.lowRise' || row === 'superstructure.lowRise'

export function rateLabel(row: RateRow, area: AreaUnit, { buildClasses }: Pick<Finance, 'buildClasses'>): string {
  if (row === 'basement') return t('assumptions.rate.basement', { unit: t(`area-unit.${area}`) })
  return !buildClasses && isOneClassRow(row) ? t(`assumptions.rate.one-class.${row}`) : t(`assumptions.rate.${row}`)
}
