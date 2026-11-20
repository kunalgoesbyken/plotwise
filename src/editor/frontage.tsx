'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { loadPack } from '@/rules'
import { ASSUMPTIONS } from '@/solve'
import { formatQuantity } from '@/text/format'
import { t } from '@/text/messages'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { PanelSection } from '@/ui/section'
import type { EditorAction } from './editor-state'
import { edgeName } from './map-features'
import { hasDecimalComma, parseMetres } from './metres'
import type { Edge, RoadEdge } from './outline'
import { useEditorState, useEditorStore, useRegion } from './plot-store'
import { EstimateTag } from './ui'

type Dispatch = (action: EditorAction) => void

type MetresInputProps = {
  label: string
  placeholder: string
  valueM: number | null
  accepts: (valueM: number) => boolean
  onValue: (valueM: number | null) => void
  describedBy?: string
  estimated?: boolean
  focus?: boolean
  required?: boolean
}

function MetresInput({ label, placeholder, valueM, accepts, onValue, describedBy, estimated = false, focus = false, required = false }: MetresInputProps) {
  const id = useId()
  const hintId = useId()
  const input = useRef<HTMLInputElement>(null)
  const [text, setText] = useState(valueM?.toString() ?? '')
  const [shown, setShown] = useState(valueM)
  if (shown !== valueM) {
    setShown(valueM)
    if (parseMetres(text) !== valueM) setText(valueM?.toString() ?? '')
  }
  const read = parseMetres(text)
  const blank = text.trim() === ''
  const invalid = blank ? required : read === null || !accepts(read)
  const comma = hasDecimalComma(text)

  useEffect(() => {
    if (focus) input.current?.focus()
  }, [focus])

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <Input
          ref={input}
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder={placeholder}
          value={text}
          aria-invalid={invalid}
          aria-describedby={[comma ? hintId : null, describedBy].filter(Boolean).join(' ') || undefined}
          data-estimated={estimated || undefined}
          onChange={(e) => {
            setText(e.target.value)
            const value = parseMetres(e.target.value)
            if (e.target.value.trim() === '') onValue(null)
            else if (value !== null && accepts(value)) onValue(value)
          }}
          className="w-20 text-right tabular-nums data-estimated:border-dashed data-estimated:border-road-foreground/50 data-estimated:bg-road/15"
        />
        <span className="text-sm text-muted-foreground">{t('frontage.metres')}</span>
        {estimated && <EstimateTag />}
      </div>
      {comma && (
        <p id={hintId} className="max-w-48 text-xs text-destructive">
          {t('input.comma')}
        </p>
      )}
    </div>
  )
}

type RoadInputsProps = { edge: number; name: string; road: RoadEdge; noteId: string; prompt: boolean; widens: boolean; dispatch: Dispatch }

function RoadInputs({ edge, name, road, noteId, prompt, widens, dispatch }: RoadInputsProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <MetresInput
        label={t('frontage.width-label', { edge: name })}
        placeholder={t('frontage.width-placeholder')}
        valueM={road.widthM}
        accepts={() => true}
        onValue={(widthM) => widthM !== null && dispatch({ type: 'set-road-width', edge, widthM })}
        describedBy={road.estimated ? noteId : undefined}
        estimated={road.estimated}
        focus={prompt}
        required
      />
      {widens && (
        <MetresInput
          label={t('frontage.prescribed-label', { edge: name })}
          placeholder={t('frontage.prescribed-placeholder')}
          valueM={road.prescribedWidthM ?? null}
          accepts={(prescribedWidthM) => road.widthM === null || prescribedWidthM > road.widthM}
          onValue={(prescribedWidthM) => dispatch({ type: 'set-prescribed-width', edge, prescribedWidthM: prescribedWidthM ?? undefined })}
        />
      )}
    </div>
  )
}

type EdgeRowProps = { index: number; edge: Edge; count: number; selected: boolean; noteId: string; widens: boolean; dispatch: Dispatch }

function EdgeRow({ index, edge, count, selected, noteId, widens, dispatch }: EdgeRowProps) {
  const name = edgeName(index, count)
  return (
    <li
      aria-current={selected || undefined}
      className="col-span-full grid min-h-14 grid-cols-subgrid items-center px-(--pad) py-1.5 transition-colors aria-current:bg-accent lg:min-h-12"
    >
      <span className="flex items-center gap-2.5 text-sm font-medium tabular-nums">
        <span aria-hidden="true" className={`w-4 rounded-full ${edge.road ? 'h-1 bg-road' : 'h-0.5 bg-plot/60'}`} />
        {name}
      </span>
      {edge.road ? (
        <RoadInputs edge={index} name={name} road={edge} noteId={noteId} prompt={selected} widens={widens} dispatch={dispatch} />
      ) : (
        <span className="text-sm text-muted-foreground">{t('frontage.boundary')}</span>
      )}
      {edge.road ? (
        <Button variant="ghost" className="w-full" aria-label={t('frontage.remove-label', { edge: name })} onClick={() => dispatch({ type: 'unmark-road', edge: index })}>
          {t('frontage.remove')}
        </Button>
      ) : (
        <Button variant="outline" className="w-full" aria-label={t('frontage.mark-label', { edge: name })} onClick={() => dispatch({ type: 'mark-road', edge: index })}>
          {t('frontage.mark')}
        </Button>
      )}
    </li>
  )
}

export function Frontage() {
  const store = useEditorStore()
  const noteId = useId()
  const { draft, selection } = useEditorState()
  const { packId } = useRegion()
  if (draft.status !== 'closed') return null
  const widens = (loadPack(packId).reservations ?? []).some((r) => r.target.kind === 'perFrontage')
  const roads = draft.corners.filter((c) => c.edge.road).length
  const estimated = draft.corners.some((c) => c.edge.road && c.edge.estimated)
  return (
    <PanelSection title={t('frontage.title')} aside={t('frontage.roads', { count: roads })} description={t('frontage.right-of-way')}>
      <ul className="-mx-(--pad) grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-4">
        {draft.corners.map((corner, index) => (
          <EdgeRow
            key={index}
            index={index}
            edge={corner.edge}
            count={draft.corners.length}
            selected={selection.kind === 'edge' && selection.index === index}
            noteId={noteId}
            widens={widens}
            dispatch={store.dispatch}
          />
        ))}
      </ul>
      {widens && roads > 0 && (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          {t('frontage.prescribed-note', { share: formatQuantity(ASSUMPTIONS.wideningShareOnPlotSide.value, 'percent') })}
        </p>
      )}
      {estimated && (
        <p id={noteId} className="mt-3 flex items-baseline gap-2 text-xs leading-relaxed text-road-foreground">
          <EstimateTag />
          {t('frontage.estimated')}
        </p>
      )}
    </PanelSection>
  )
}
