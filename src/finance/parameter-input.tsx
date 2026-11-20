'use client'

import { useId, useState } from 'react'
import type { MoneyRegion } from '@/solve'
import { t } from '@/text/messages'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import { isValidValue, type Parameter } from './parameters'
import type { Finance } from './use-finance'

const SHARE_SCALE = 100
const PRECISION = 12

const roundOff = (value: number) => Number(value.toPrecision(PRECISION))

function parse(text: string, scale: number) {
  return text.trim() === '' ? Number.NaN : roundOff(Number(text.replaceAll(',', '')) / scale)
}

function suffixFor({ unit }: Parameter, { currency, landUnit }: MoneyRegion) {
  switch (unit) {
    case 'money':
      return t('money.per-sqm', { currency })
    case 'landMoney':
      return t('money.per-land-unit', { currency, unit: landUnit.name })
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
  const [draft, setDraft] = useState<string | null>(null)
  const scale = parameter.unit === 'share' ? SHARE_SCALE : 1
  const shown = draft ?? String(roundOff(finance.valueOf(parameter) * scale))
  const invalid = draft !== null && !isValidValue(parameter, parse(draft, scale))

  function change(text: string) {
    setDraft(text)
    const value = parse(text, scale)
    if (isValidValue(parameter, value)) finance.edit(parameter, value)
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
          aria-invalid={invalid}
          onChange={(event) => change(event.target.value)}
          onBlur={() => setDraft(null)}
          className="w-32"
        />
        <span className="text-xs text-muted-foreground">{suffixFor(parameter, finance.region)}</span>
      </div>
    </div>
  )
}
