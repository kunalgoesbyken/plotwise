'use client'

import { useId, useState } from 'react'
import type { Design } from '@/designs'
import { t } from '@/text/messages'
import { readNumber } from '@/text/read-number'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import { isAskingPrice } from './asking-price'
import { useAssumptions } from './assumptions-provider'
import { askingText } from './figures'
import type { Finance } from './use-finance'

type Entry = { readonly kind: 'blank' } | { readonly kind: 'price'; readonly price: number } | { readonly kind: 'invalid'; readonly comma: boolean }

function entryOf(text: string): Entry {
  const read = readNumber(text)
  if (read.kind === 'blank') return read
  if (read.kind === 'number' && isAskingPrice(read.value)) return { kind: 'price', price: read.value }
  return { kind: 'invalid', comma: read.kind === 'unreadable' && read.reason === 'comma' }
}

export function AskingPrice({ finance, design }: { readonly finance: Finance; readonly design: Design }) {
  const id = useId()
  const hintId = useId()
  const { askingPrice, setAskingPrice } = useAssumptions()
  const [draft, setDraft] = useState<string | null>(null)
  const entry = draft === null ? null : entryOf(draft)
  const comma = entry?.kind === 'invalid' && entry.comma
  const { currency } = finance.region

  function change(text: string) {
    setDraft(text)
    const next = entryOf(text)
    if (next.kind !== 'invalid') setAskingPrice(next.kind === 'price' ? next.price : null)
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor={id} className="text-xs font-normal text-muted-foreground">
          {t('asking.label')}
        </Label>
        <Input
          id={id}
          inputMode="decimal"
          value={draft ?? (askingPrice === null ? '' : String(askingPrice))}
          aria-invalid={entry?.kind === 'invalid'}
          aria-describedby={comma ? hintId : undefined}
          onChange={(event) => change(event.target.value)}
          onBlur={() => setDraft(null)}
          className="w-32"
        />
        {currency && <span className="text-xs text-muted-foreground">{currency}</span>}
      </div>
      {comma && (
        <p id={hintId} className="text-xs text-destructive">
          {t('input.comma')}
        </p>
      )}
      {askingPrice !== null && (
        <p aria-live="polite" className="text-xs leading-snug font-medium">
          {askingText(askingPrice, finance, design)}
        </p>
      )}
    </div>
  )
}
