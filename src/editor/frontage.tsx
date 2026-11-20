'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { t } from '@/text/messages'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { PanelSection } from '@/ui/section'
import type { EditorAction } from './editor-state'
import { edgeName } from './map-features'
import { parseMetres } from './metres'
import type { Edge } from './outline'
import { useEditorState, useEditorStore } from './plot-store'
import { EstimateTag } from './ui'

type Dispatch = (action: EditorAction) => void

type RoadWidthProps = {
  edge: number
  name: string
  widthM: number | null
  estimated: boolean
  noteId: string
  prompt: boolean
  dispatch: Dispatch
}

function RoadWidth({ edge, name, widthM, estimated, noteId, prompt, dispatch }: RoadWidthProps) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const [text, setText] = useState(widthM?.toString() ?? '')
  const [shown, setShown] = useState(widthM)
  if (shown !== widthM) {
    setShown(widthM)
    if (parseMetres(text) !== widthM) setText(widthM?.toString() ?? '')
  }
  const invalid = parseMetres(text) === null

  useEffect(() => {
    if (prompt) input.current?.focus()
  }, [prompt])

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="sr-only">
        {t('frontage.width-label', { edge: name })}
      </label>
      <Input
        ref={input}
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder={t('frontage.width-placeholder')}
        value={text}
        aria-invalid={invalid}
        aria-describedby={estimated ? noteId : undefined}
        data-estimated={estimated || undefined}
        onChange={(e) => {
          setText(e.target.value)
          const value = parseMetres(e.target.value)
          if (value !== null) dispatch({ type: 'set-road-width', edge, widthM: value })
        }}
        className="w-20 text-right tabular-nums data-estimated:border-dashed data-estimated:border-road-foreground/50 data-estimated:bg-road/15"
      />
      <span className="text-sm text-muted-foreground">{t('frontage.metres')}</span>
      {estimated && <EstimateTag />}
    </div>
  )
}

type EdgeRowProps = { index: number; edge: Edge; count: number; selected: boolean; noteId: string; dispatch: Dispatch }

function EdgeRow({ index, edge, count, selected, noteId, dispatch }: EdgeRowProps) {
  const name = edgeName(index, count)
  return (
    <li
      aria-current={selected || undefined}
      className="col-span-full grid min-h-14 grid-cols-subgrid items-center px-(--pad) py-1.5 transition-colors aria-current:bg-accent lg:min-h-12"
    >
      <span className="flex items-center gap-2.5 text-sm font-medium tabular-nums">
        <span aria-hidden="true" className={`w-4 rounded-full ${edge.road ? 'h-1 bg-road' : 'h-0.5 bg-primary/60'}`} />
        {name}
      </span>
      {edge.road ? (
        <RoadWidth edge={index} name={name} widthM={edge.widthM} estimated={edge.estimated} noteId={noteId} prompt={selected} dispatch={dispatch} />
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
  if (draft.status !== 'closed') return null
  const roads = draft.corners.filter((c) => c.edge.road).length
  const estimated = draft.corners.some((c) => c.edge.road && c.edge.estimated)
  return (
    <PanelSection title={t('frontage.title')} aside={t('frontage.roads', { count: roads })}>
      <ul className="-mx-(--pad) grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-4">
        {draft.corners.map((corner, index) => (
          <EdgeRow
            key={index}
            index={index}
            edge={corner.edge}
            count={draft.corners.length}
            selected={selection.kind === 'edge' && selection.index === index}
            noteId={noteId}
            dispatch={store.dispatch}
          />
        ))}
      </ul>
      {estimated && (
        <p id={noteId} className="mt-3 flex items-baseline gap-2 text-xs leading-relaxed text-road-foreground">
          <EstimateTag />
          {t('frontage.estimated')}
        </p>
      )}
    </PanelSection>
  )
}
