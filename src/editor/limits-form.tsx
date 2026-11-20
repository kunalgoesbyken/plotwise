'use client'

import { useId, useState } from 'react'
import { PlotLimitsSchema, type PlotLimitField } from '@/plot/plot'
import type { Region } from '@/region/regions'
import { loadPack } from '@/rules'
import { AFFECTION_PLAN_TERMS, plotLimitFields } from '@/solve'
import { t } from '@/text/messages'
import { Disclosure } from '@/ui/disclosure'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import { PanelSection } from '@/ui/section'
import { FIELD_UNITS, parseLimit, shownLimit, type LimitDisplay } from './limit-fields'
import { useEditorState, useEditorStore, useRegion } from './plot-store'

const displayOf = ({ areaUnit, rules }: Region): LimitDisplay => ({ area: areaUnit, floors: rules === 'affectionPlan' ? 'aboveGround' : 'storeys' })

const labelOf = (field: PlotLimitField, region: Region) =>
  region.rules === 'affectionPlan' && field !== 'minOpenSpaceShare' ? AFFECTION_PLAN_TERMS[field].value : t(`limits.custom.${field}`)

function unitOf(field: PlotLimitField, { area, floors }: LimitDisplay): string {
  const areaName = t(`area-unit.${area}`)
  switch (FIELD_UNITS[field]) {
    case 'area':
      return areaName
    case 'perSpace':
      return t('limits.unit.per-space', { unit: areaName })
    case 'percent':
      return t('limits.unit.percent')
    case 'm':
      return t('limits.unit.m')
    case 'ratio':
      return t('limits.unit.ratio')
    case 'storeys':
      return floors === 'aboveGround' ? t('limits.unit.floors') : t('limits.unit.storeys')
  }
}

const isAccepted = (field: PlotLimitField, value: number | undefined | null): value is number | undefined =>
  value !== null && (value === undefined || PlotLimitsSchema.shape[field].safeParse(value).success)

type LimitInputProps = { readonly field: PlotLimitField; readonly value: number | undefined; readonly region: Region }

function LimitInput({ field, value, region }: LimitInputProps) {
  const store = useEditorStore()
  const id = useId()
  const display = displayOf(region)
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? (value === undefined ? '' : shownLimit(field, value, display))
  const invalid = draft !== null && !isAccepted(field, parseLimit(field, draft, display))

  function change(text: string) {
    setDraft(text)
    const parsed = parseLimit(field, text, display)
    if (isAccepted(field, parsed)) store.dispatch({ type: 'set-limit', field, value: parsed })
  }

  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <Label htmlFor={id} className="min-w-0 text-sm leading-snug font-normal">
        {labelOf(field, region)}
      </Label>
      <div className="flex shrink-0 items-center gap-2">
        <Input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={shown}
          aria-invalid={invalid}
          onChange={(event) => change(event.target.value)}
          onBlur={() => setDraft(null)}
          className="w-24 text-right tabular-nums"
        />
        <span className="w-20 text-xs text-muted-foreground">{unitOf(field, display)}</span>
      </div>
    </li>
  )
}

function AffectionPlanTerms() {
  const { plan, use, ...fields } = AFFECTION_PLAN_TERMS
  return (
    <Disclosure label={t('limits.terms')} tone="muted" className="mt-2">
      <ul className="flex flex-col gap-2 pb-2 text-xs leading-relaxed text-muted-foreground">
        {[plan, use, ...Object.values(fields)].map((term) => (
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
  const affectionPlan = region.rules === 'affectionPlan'
  return (
    <PanelSection title={t(`limits.title.${region.rules}`)} description={t(`limits.intro.${region.rules}`)}>
      <ul className="flex flex-col divide-y">
        {fields.map((field) => (
          <LimitInput key={field} field={field} value={draft.limits[field]} region={region} />
        ))}
      </ul>
      {affectionPlan && <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{t('limits.use.affectionPlan', { term: AFFECTION_PLAN_TERMS.use.value })}</p>}
      {affectionPlan && <AffectionPlanTerms />}
    </PanelSection>
  )
}
