import { t } from '@/text/messages'
import { formatMoney } from './format-money'
import { totalOf, type Estimate, type Parking, type Range } from './estimate'

export const rangeText = ({ low, high }: Range, currency: string) =>
  t('money.range', { low: formatMoney(low, currency), high: formatMoney(high, currency) })

export const parkingText = ({ levelsAboveGround, basementLevels }: Parking) =>
  t('money.parking-levels-value', { above: levelsAboveGround, basement: basementLevels })

export const firstCostRange = ({ firstCost }: Estimate): Range => ({ low: totalOf(firstCost.low), high: totalOf(firstCost.high) })
