'use client'

import { useId, useState } from 'react'
import { PlotLimitsSchema, type PlotLimitField } from '@/plot/plot'
import type { LimitTerms, Region } from '@/region/regions'
import { loadPack } from '@/rules'
import { plotLimitFields } from '@/solve'
import { t } from '@/text/messages'
import type { ReadNumber } from '@/text/read-number'
import { Disclosure } from '@/ui/disclosure'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import { PanelSection } from '@/ui/section'
import { FIELD_UNITS, limitDisplay, limitLabel, parseLimit, shownLimit, type LimitDisplay } from './limit-fields'
import { useEditorState, useEditorStore, useRegion } from './plot-store'

type Affix = { readonly prefix: string | null; readonly suffix: string | null }

function affixOf(field: PlotLimitField, { area, floors }: LimitDisplay): Affix {
  const areaName = t(`area-unit.${area}`)
  switch (FIELD_UNITS[field]) {
    case 'area':
      return { prefix: null, suffix: areaName }
    case 'perSpace':
      return { prefix: null, suffix: t('limits.unit.per-space', { unit: areaName }) }
    case 'percent':
      return { prefix: null, suffix: t('limits.unit.percent') }
    case 'm':
      return { prefix: null, suffix: t('limits.unit.m') }
    case 'ratio':
      return { prefix: null, suffix: t('limits.unit.ratio') }
    case 'storeys':
      return floors === 'gPlus' ? { prefix: t('limits.unit.g-plus'), suffix: null } : { prefix: null, suffix: t('limits.unit.storeys') }
  }
}

const isAccepted = (field: PlotLimitField, read: ReadNumber) =>
  read.kind === 'blank' || (read.kind === 'number' && PlotLimitsSchema.shape[field].safeParse(read.value).success)

type LimitInputProps = { readonly field: PlotLimitField; readonly value: number | undefined; readonly region: Region }

function LimitInput({ field, value, region }: LimitInputProps) {
  const store = useEditorStore()
  const id = useId()
  const hintId = useId()
  const display = limitDisplay(region)
  const { prefix, suffix } = affixOf(field, display)
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? (value === undefined ? '' : shownLimit(field, value, display))
  const read = draft === null ? null : parseLimit(field, draft, display)
  const invalid = read !== null && !isAccepted(field, read)
  const comma = read?.kind === 'unreadable' && read.reason === 'comma'

  function change(text: string) {
    setDraft(text)
    const next = parseLimit(field, text, display)
    if (!isAccepted(field, next)) return
    store.dispatch({ type: 'set-limit', field, value: next.kind === 'number' ? next.value : undefined })
  }

  return (
    <li className="flex flex-col gap-1 py-2">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id} className="min-w-0 text-sm leading-snug font-normal">
          {limitLabel(field, region)}
        </Label>
        <div className="flex shrink-0 items-center gap-2">
          {prefix && <span className="text-xs text-muted-foreground">{prefix}</span>}
          <Input
            id={id}
            inputMode="decimal"
            autoComplete="off"
            value={shown}
            aria-invalid={invalid}
            aria-describedby={comma ? hintId : undefined}
            onChange={(event) => change(event.target.value)}
            onBlur={() => setDraft(null)}
            className="w-24 text-right tabular-nums"
          />
          <span className="w-20 text-xs text-muted-foreground">{suffix}</span>
        </div>
      </div>
      {comma && (
        <p id={hintId} className="text-right text-xs text-destructive">
          {t('input.comma')}
        </p>
      )}
    </li>
  )
}

function TermSources({ terms }: { terms: LimitTerms }) {
  const all = [terms.document, terms.use, ...Object.values(terms.fields)]
  return (
    <Disclosure label={t('limits.terms')} tone="muted" className="mt-2">
      <ul className="flex flex-col gap-2 pb-2 text-xs leading-relaxed text-muted-foreground">
        {all.map((term) => (
          <li key={term.value}>
            <span className="font-medium text-foreground">{term.value}.</span> {term.source}
          </li>
        ))}
      </ul>
    </Disclosure>
  )
}

export function LimitsForm() {
  const region = useRegion()
  const { draft } = useEditorState()
  const fields = plotLimitFields(loadPack(region.packId))
  if (fields.length === 0) return null
  const terms = region.limitTerms
  return (
    <PanelSection title={t(`limits.title.${region.rules}`)} description={t(`limits.intro.${region.rules}`)}>
      <ul className="flex flex-col divide-y">
        {fields.map((field) => (
          <LimitInput key={field} field={field} value={draft.limits[field]} region={region} />
        ))}
      </ul>
      {terms && (
        <>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            {t('limits.use', { use: terms.use.value, document: terms.document.value.toLowerCase() })}
          </p>
          <TermSources terms={terms} />
        </>
      )}
    </PanelSection>
  )
}
