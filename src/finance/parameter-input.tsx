'use client'

import { useId, useState } from 'react'
import { useRegion } from '@/editor/plot-store'
import type { MoneyRegion } from '@/solve'
import { t } from '@/text/messages'
import { readNumber } from '@/text/read-number'
import { Label } from '@/ui/label'
import { NumberInput } from '@/ui/number-input'
import { perAreaFromDisplay, perAreaToDisplay, type AreaUnit } from '@/units/area'
import { formatAmount } from './format-money'
import { isValidValue, type Input as MoneyInput } from './parameters'
import type { Finance } from './use-finance'

const SHARE_SCALE = 100
const PRECISION = 12

const roundOff = (value: number) => Number(value.toPrecision(PRECISION))

function toShown({ unit }: MoneyInput, value: number, area: AreaUnit): number {
  if (unit === 'share') return value * SHARE_SCALE
  return unit === 'money' ? perAreaToDisplay(value, area) : value
}

function shownText(parameter: MoneyInput, value: number, area: AreaUnit): string {
  const shown = toShown(parameter, value, area)
  return parameter.unit === 'money' || parameter.unit === 'landMoney' ? formatAmount(shown) : String(roundOff(shown))
}

function fromShown({ unit }: MoneyInput, shown: number, area: AreaUnit): number {
  if (unit === 'share') return shown / SHARE_SCALE
  return unit === 'money' ? perAreaFromDisplay(shown, area) : shown
}

function parse(text: string, parameter: MoneyInput, area: AreaUnit) {
  const read = readNumber(text)
  return read.kind === 'number' ? roundOff(fromShown(parameter, read.value, area)) : Number.NaN
}

const perUnit = ({ currency }: MoneyRegion, unit: string) => (currency ? t('money.per-unit-in', { currency, unit }) : t('money.per-unit', { unit }))

function suffixFor({ unit }: MoneyInput, region: MoneyRegion, area: AreaUnit) {
  switch (unit) {
    case 'money':
      return perUnit(region, t(`area-unit.${area}`))
    case 'landMoney':
      return perUnit(region, region.landUnit.name)
    case 'share':
      return '%'
    case 'count':
      return ''
  }
}

type ParameterInputProps = {
  readonly finance: Finance
  readonly parameter: MoneyInput
  readonly label: string
  readonly hideLabel?: boolean
}

export function ParameterInput({ finance, parameter, label, hideLabel = false }: ParameterInputProps) {
  const id = useId()
  const hintId = useId()
  const { areaUnit } = useRegion()
  const [draft, setDraft] = useState<string | null>(null)
  const value = finance.valueOf(parameter)
  const shown = draft ?? (value === null ? '' : shownText(parameter, value, areaUnit))
  const invalid = draft !== null && !isValidValue(parameter, parse(draft, parameter, areaUnit))
  const read = draft === null ? null : readNumber(draft)
  const comma = read?.kind === 'unreadable' && read.reason === 'comma'

  function change(text: string) {
    setDraft(text)
    const parsed = parse(text, parameter, areaUnit)
    if (isValidValue(parameter, parsed)) finance.edit(parameter, parsed)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className={hideLabel ? 'sr-only' : 'text-xs font-normal text-muted-foreground'}>
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <NumberInput
          id={id}
          value={shown}
          required={value === null}
          aria-invalid={invalid}
          aria-describedby={comma ? hintId : undefined}
          onText={change}
          onBlur={() => setDraft(null)}
          className="w-32"
        />
        <span className="text-xs text-muted-foreground">{suffixFor(parameter, finance.region, areaUnit)}</span>
      </div>
      {comma && (
        <p id={hintId} className="text-xs text-destructive">
          {t('input.comma')}
        </p>
      )}
    </div>
  )
}
