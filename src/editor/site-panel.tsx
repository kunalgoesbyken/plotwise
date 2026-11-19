'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { BUILDING_TYPES } from '@/plot/plot'
import { loadPack } from '@/rules'
import { stationDistance } from '@/solve'
import { formatQuantity } from '@/text/format'
import { t } from '@/text/messages'
import type { EditorAction } from './editor-state'
import { EXAMPLE_PLOT } from './example-plot'
import { edgeName } from './map-features'
import { parseMetres } from './metres'
import type { Edge } from './outline'
import { useEditorState, useEditorStore } from './plot-store'
import { Button, PanelSection, Placeholder, PointerText, SEGMENT, SEGMENTS } from './ui'

const PACK = loadPack('bkk-y9')
const STATION_DISTANCE_M = stationDistance(PACK).value
const BMA_CITY_PLAN_URL = 'https://webportal.bangkok.go.th/cpud'

type Dispatch = (action: EditorAction) => void

function PlotOutline() {
  const store = useEditorStore()
  const { draft } = useEditorState()
  const count = draft.status === 'closed' ? draft.corners.length : draft.points.length
  const empty = draft.status === 'drawing' && count === 0

  return (
    <PanelSection title={t('plot.title')} aside={empty ? undefined : t('plot.corners', { count })}>
      {empty ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm leading-relaxed text-slate">
            <PointerText text={(verb) => t('plot.start', { verb })} />
          </p>
          <Button onClick={() => store.dispatch({ type: 'load', plot: EXAMPLE_PLOT })}>{t('plot.example')}</Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm">{t(draft.status === 'closed' ? 'plot.closed' : 'plot.drawing')}</p>
          <Button tone="danger" onClick={() => store.dispatch({ type: 'clear' })}>
            {t('plot.clear')}
          </Button>
        </div>
      )}
    </PanelSection>
  )
}

function EstimateTag() {
  return (
    <span aria-hidden="true" className="rounded-sm bg-road/20 px-1.5 font-mono text-2xs font-medium text-road-ink">
      {t('frontage.estimated-tag')}
    </span>
  )
}

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
      <input
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
        className="h-11 w-20 rounded-md border border-rule bg-paper px-2.5 text-right font-mono text-sm tabular-nums transition-colors duration-150 placeholder:text-slate hover:border-slate focus-visible:border-plot aria-invalid:border-signal data-estimated:border-dashed data-estimated:border-road-ink/60 data-estimated:bg-road/10 lg:h-9"
      />
      <span className="font-mono text-sm text-slate">{t('frontage.metres')}</span>
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
      className="col-span-full grid min-h-14 grid-cols-subgrid items-center px-(--pad) py-1.5 transition-colors duration-150 aria-current:bg-plot-wash lg:min-h-12"
    >
      <span className="flex items-center gap-2.5 font-mono text-sm">
        <span aria-hidden="true" className={`w-4 rounded-full ${edge.road ? 'h-1 bg-road' : 'h-0.5 bg-plot/60'}`} />
        {name}
      </span>
      {edge.road ? (
        <RoadWidth
          edge={index}
          name={name}
          widthM={edge.widthM}
          estimated={edge.estimated}
          noteId={noteId}
          prompt={selected}
          dispatch={dispatch}
        />
      ) : (
        <span className="text-sm text-slate">{t('frontage.boundary')}</span>
      )}
      {edge.road ? (
        <Button className="w-full" aria-label={t('frontage.remove-label', { edge: name })} onClick={() => dispatch({ type: 'unmark-road', edge: index })}>
          {t('frontage.remove')}
        </Button>
      ) : (
        <Button className="w-full" aria-label={t('frontage.mark-label', { edge: name })} onClick={() => dispatch({ type: 'mark-road', edge: index })}>
          {t('frontage.mark')}
        </Button>
      )}
    </li>
  )
}

function Frontage() {
  const store = useEditorStore()
  const noteId = useId()
  const { draft, selection } = useEditorState()
  if (draft.status !== 'closed') {
    return (
      <PanelSection title={t('frontage.title')}>
        <Placeholder>{t('frontage.waiting')}</Placeholder>
      </PanelSection>
    )
  }
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
        <p id={noteId} className="mt-3 flex items-baseline gap-2 text-xs leading-relaxed text-road-ink">
          <EstimateTag />
          {t('frontage.estimated')}
        </p>
      )}
    </PanelSection>
  )
}

function BuildingTypePicker() {
  const store = useEditorStore()
  const { draft } = useEditorState()
  return (
    <PanelSection title={t('building-type.title')}>
      <fieldset className={`${SEGMENTS} grid-cols-3`}>
        <legend className="sr-only">{t('building-type.title')}</legend>
        {BUILDING_TYPES.map((type) => (
          <label
            key={type}
            className={`${SEGMENT} cursor-pointer text-sm has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-plot`}
          >
            <input
              type="radio"
              name="building-type"
              value={type}
              checked={draft.buildingType === type}
              onChange={() => store.dispatch({ type: 'set-building-type', buildingType: type })}
              className="sr-only"
            />
            {t(`building.${type}`)}
          </label>
        ))}
      </fieldset>
    </PanelSection>
  )
}

function Zone() {
  return (
    <PanelSection title={t('zone.title')}>
      <p className="text-sm font-medium">{t('zone.name', { code: PACK.zone.code })}</p>
      <p className="mt-1 max-w-prose text-xs leading-relaxed text-slate">{t('zone.scope')}</p>
      <a
        href={BMA_CITY_PLAN_URL}
        target="_blank"
        rel="noreferrer"
        className="mt-1 inline-flex min-h-11 items-center text-xs font-medium text-plot underline decoration-plot/30 underline-offset-2 transition-colors hover:decoration-plot lg:min-h-8"
      >
        {t('zone.check')}
      </a>
    </PanelSection>
  )
}

function StationToggle() {
  const store = useEditorStore()
  const { draft } = useEditorState()
  return (
    <PanelSection title={t('transit.title')}>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm lg:min-h-9">
        <input
          type="checkbox"
          checked={draft.nearStation}
          onChange={(e) => store.dispatch({ type: 'set-near-station', nearStation: e.target.checked })}
          className="size-4.5 shrink-0 accent-plot"
        />
        {t('transit.near', { distance: formatQuantity(STATION_DISTANCE_M, 'm') })}
      </label>
    </PanelSection>
  )
}

export function SitePanel() {
  return (
    <>
      <PlotOutline />
      <Zone />
      <Frontage />
      <BuildingTypePicker />
      <StationToggle />
    </>
  )
}
