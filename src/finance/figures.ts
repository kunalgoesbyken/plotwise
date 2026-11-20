import { t } from '@/text/messages'
import type { AreaUnit } from '@/units/area'
import { formatMoney } from './format-money'
import { totalOf, type Estimate, type Parking, type Range } from './estimate'
import type { RateRow, ScalarId } from './parameters'

export const rangeText = ({ low, high }: Range, currency: string | null) =>
  t('money.range', { low: formatMoney(low, currency), high: formatMoney(high, currency) })

export const parkingText = ({ levelsAboveGround, basementLevels }: Parking) =>
  t('money.parking-levels-value', { above: levelsAboveGround, basement: basementLevels })

export const firstCostRange = ({ firstCost }: Estimate): Range => ({ low: totalOf(firstCost.low), high: totalOf(firstCost.high) })

export const scalarLabel = (id: ScalarId, area: AreaUnit) =>
  id === 'salePrice' ? t('assumptions.salePrice', { unit: t(`area-unit.${area}`) }) : t(`assumptions.${id}`)

export const rateLabel = (row: RateRow, area: AreaUnit) =>
  row === 'basement' ? t('assumptions.rate.basement', { unit: t(`area-unit.${area}`) }) : t(`assumptions.rate.${row}`)
