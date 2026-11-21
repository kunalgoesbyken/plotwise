import type { Design } from '@/designs'
import type { Region } from '@/region/regions'
import { t } from '@/text/messages'
import type { AreaUnit } from '@/units/area'
import { askingVerdict } from './asking-price'
import { formatMoney } from './format-money'
import { totalOf, type Estimate, type Parking, type Range } from './estimate'
import { PURCHASE_PRICES, SCALARS, type Input, type PurchasePriceId, type RateRow, type ScalarId } from './parameters'
import type { Finance } from './use-finance'

export const rangeText = ({ low, high }: Range, currency: string | null) =>
  t('money.range', { low: formatMoney(low, currency), high: formatMoney(high, currency) })

export const hasLandValue = ({ high }: Range) => high > 0

export const noLandValueText = ({ low, high }: Range, currency: string | null) =>
  t('land.none', { shortfall: rangeText({ low: -high, high: -low }, currency) })

export const landValueText = (landValue: Range, currency: string | null) =>
  hasLandValue(landValue) ? rangeText({ low: Math.max(0, landValue.low), high: landValue.high }, currency) : noLandValueText(landValue, currency)

export function askingText(asking: number, { priced, region }: Pick<Finance, 'priced' | 'region'>, design: Design): string {
  const verdict = askingVerdict(asking, priced && priced.estimateFor(design).landValue)
  const shown = formatMoney(asking, region.currency)
  switch (verdict.kind) {
    case 'within':
      return t('asking.within', { asking: shown })
    case 'above':
      return t('asking.above', { asking: shown, margin: formatMoney(verdict.margin, region.currency) })
    case 'below':
      return t('asking.below', { asking: shown, margin: formatMoney(verdict.margin, region.currency) })
    case 'unsupported':
      return t('asking.unsupported', { asking: shown })
    case 'unavailable':
      return t('asking.unavailable', { asking: shown })
  }
}

export const parkingText = ({ levelsAboveGround, basementLevels }: Parking) =>
  t('money.parking-levels-value', { above: levelsAboveGround, basement: basementLevels })

export const firstCostRange = ({ firstCost }: Estimate): Range => ({ low: totalOf(firstCost.low), high: totalOf(firstCost.high) })

export function scalarLabel(id: ScalarId, { areaUnit, areaTerms }: Region): string {
  if (id === 'salePrice') return t('assumptions.salePrice', { unit: t(`area-unit.${areaUnit}`), saleable: areaTerms.saleable })
  return id === 'saleableShare' ? t('assumptions.saleableShare', areaTerms) : t(`assumptions.${id}`)
}

export const purchasePriceLabel = (id: PurchasePriceId, { areaUnit, areaTerms }: Region) =>
  id === 'landRate' ? t('land.landRate', { rate: areaTerms.landRate, unit: t(`area-unit.${areaUnit}`) }) : t('land.tdrPrice', { unit: t(`area-unit.${areaUnit}`) })

type MissingRows = Pick<Finance, 'missing' | 'rates' | 'buildClasses'>

export function missingLabels(region: Region, finance: MissingRows): readonly string[] {
  const missing = new Set<Input>(finance.missing)
  return [
    ...(Object.keys(SCALARS) as ScalarId[]).filter((id) => missing.has(SCALARS[id])).map((id) => scalarLabel(id, region)),
    ...finance.rates
      .filter(({ low, high }) => missing.has(low) || missing.has(high))
      .map(({ row }) => t('assumptions.rate-range', { row: rateLabel(row, region.areaUnit, finance) })),
    ...Object.values(PURCHASE_PRICES)
      .filter((input) => missing.has(input))
      .map((input) => purchasePriceLabel(input.id, region)),
  ]
}

type OneClassRow = Extract<RateRow, 'substructure.lowRise' | 'superstructure.lowRise'>

const isOneClassRow = (row: RateRow): row is OneClassRow => row === 'substructure.lowRise' || row === 'superstructure.lowRise'

export function rateLabel(row: RateRow, area: AreaUnit, { buildClasses }: Pick<Finance, 'buildClasses'>): string {
  if (row === 'basement') return t('assumptions.rate.basement', { unit: t(`area-unit.${area}`) })
  return !buildClasses && isOneClassRow(row) ? t(`assumptions.rate.one-class.${row}`) : t(`assumptions.rate.${row}`)
}
