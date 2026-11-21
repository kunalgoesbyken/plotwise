'use client'

import { useId, useState } from 'react'
import type { Design } from '@/designs'
import type { MoneyRegion } from '@/solve'
import { t } from '@/text/messages'
import { Label } from '@/ui/label'
import { NumberInput } from '@/ui/number-input'
import { ToggleGroup, ToggleGroupItem } from '@/ui/toggle-group'
import { readAsking, shownAsking, type AskingBasis, type AskingEntry } from './asking-entry'
import { MAX_ASKING_PRICE } from './asking-price'
import { useAssumptions } from './assumptions-provider'
import { askingText } from './figures'
import { formatAmount, formatMoney } from './format-money'
import type { Finance } from './use-finance'

type BasisKind = AskingBasis['kind']

const BASIS_KINDS: readonly BasisKind[] = ['total', 'perLandUnit']

const isBasisKind = (value: string): value is BasisKind => (BASIS_KINDS as readonly string[]).includes(value)

const basisLabel = (kind: BasisKind, { landUnit }: MoneyRegion) => (kind === 'total' ? t('asking.total') : t('asking.per-land-unit', { unit: landUnit.name }))

function hintOf(entry: AskingEntry | null, currency: string | null): string | null {
  if (entry?.kind !== 'invalid') return null
  return entry.comma ? t('input.comma') : t('asking.invalid', { max: formatMoney(MAX_ASKING_PRICE, currency) })
}

const basisOf = (kind: BasisKind, { landUnits }: Finance): AskingBasis => (kind === 'total' ? { kind } : { kind, landUnits })

export function AskingPrice({ finance, design }: { readonly finance: Finance; readonly design: Design }) {
  const id = useId()
  const hintId = useId()
  const { askingPrice, setAskingPrice } = useAssumptions()
  const [kind, setKind] = useState<BasisKind>('total')
  const [draft, setDraft] = useState<string | null>(null)
  const basis = basisOf(kind, finance)
  const entry = draft === null ? null : readAsking(draft, basis)
  const { currency } = finance.region
  const hint = hintOf(entry, currency)
  const invalid = hint !== null

  function change(text: string) {
    setDraft(text)
    const next = readAsking(text, basis)
    if (next.kind !== 'invalid') setAskingPrice(next.kind === 'price' ? next.price : null)
  }

  function choose(value: string) {
    if (!isBasisKind(value)) return
    setKind(value)
    setDraft(null)
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor={id} className="text-xs font-normal text-muted-foreground">
          {t('asking.label')}
        </Label>
        <NumberInput
          id={id}
          value={draft ?? (askingPrice === null ? '' : formatAmount(shownAsking(askingPrice, basis)))}
          aria-invalid={invalid}
          aria-describedby={hint ? hintId : undefined}
          onText={change}
          onBlur={() => {
            if (!invalid) setDraft(null)
          }}
          className="w-36"
        />
        {currency && <span className="text-xs text-muted-foreground">{currency}</span>}
        <ToggleGroup type="single" variant="outline" size="sm" aria-label={t('asking.basis')} value={kind} onValueChange={choose}>
          {BASIS_KINDS.map((option) => (
            <ToggleGroupItem key={option} value={option} className="px-2 text-xs data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background">
              {basisLabel(option, finance.region)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      {hint && (
        <p id={hintId} className="text-xs text-destructive">
          {hint}
        </p>
      )}
      {askingPrice !== null && !invalid && (
        <p aria-live="polite" className="text-xs leading-snug font-medium">
          {askingText(askingPrice, finance, design)}
        </p>
      )}
    </div>
  )
}
