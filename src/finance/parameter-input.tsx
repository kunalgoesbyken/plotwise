'use client'

import { useId, useState } from 'react'
import { useRegion } from '@/editor/plot-store'
import type { MoneyRegion } from '@/solve'
import { t } from '@/text/messages'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import { perAreaFromDisplay, perAreaToDisplay, type AreaUnit } from '@/units/area'
import { isValidValue, type Parameter } from './parameters'
import type { Finance } from './use-finance'

const SHARE_SCALE = 100
const PRECISION = 12

const roundOff = (value: number) => Number(value.toPrecision(PRECISION))

function toShown({ unit }: Parameter, value: number, area: AreaUnit): number {
  if (unit === 'share') return value * SHARE_SCALE
  return unit === 'money' ? perAreaToDisplay(value, area) : value
}

function fromShown({ unit }: Parameter, shown: number, area: AreaUnit): number {
  if (unit === 'share') return shown / SHARE_SCALE
  return unit === 'money' ? perAreaFromDisplay(shown, area) : shown
}

function parse(text: string, parameter: Parameter, area: AreaUnit) {
  return text.trim() === '' ? Number.NaN : roundOff(fromShown(parameter, Number(text.replaceAll(',', '')), area))
}

const perUnit = ({ currency }: MoneyRegion, unit: string) => (currency ? t('money.per-unit-in', { currency, unit }) : t('money.per-unit', { unit }))

function suffixFor({ unit }: Parameter, region: MoneyRegion, area: AreaUnit) {
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
  readonly parameter: Parameter
  readonly label: string
  readonly hideLabel?: boolean
}

export function ParameterInput({ finance, parameter, label, hideLabel = false }: ParameterInputProps) {
  const id = useId()
  const { areaUnit } = useRegion()
  const [draft, setDraft] = useState<string | null>(null)
  const value = finance.valueOf(parameter)
  const shown = draft ?? (value === null ? '' : String(roundOff(toShown(parameter, value, areaUnit))))
  const invalid = draft !== null && !isValidValue(parameter, parse(draft, parameter, areaUnit))

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
        <Input
          id={id}
          inputMode="decimal"
          value={shown}
          required={value === null}
          aria-invalid={invalid}
          onChange={(event) => change(event.target.value)}
          onBlur={() => setDraft(null)}
          className="w-32"
        />
        <span className="text-xs text-muted-foreground">{suffixFor(parameter, finance.region, areaUnit)}</span>
      </div>
    </div>
  )
}
