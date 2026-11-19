'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { BUILDING_TYPES } from '@/plot/plot'
import { loadPack } from '@/rules'
import { stationDistance } from '@/solve'
import { formatQuantity } from '@/text/format'
import { t } from '@/text/messages'
import type { EditorAction } from './editor-state'
import { EXAMPLE_PLOT } from '@/plot/example-plot'
import { edgeName } from './map-features'
import { parseMetres } from './metres'
import type { Edge } from './outline'
import { useEditorState, useEditorStore } from './plot-store'
import { Button, PanelSection, Placeholder, PointerText } from './ui'

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
          <Placeholder>
            <PointerText text={(verb) => t('plot.start', { verb })} />
          </Placeholder>
          <Button onClick={() => store.dispatch({ type: 'load', plot: EXAMPLE_PLOT })}>{t('plot.example')}</Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <p className="mr-auto text-sm">{t(draft.status === 'closed' ? 'plot.closed' : 'plot.drawing')}</p>
          <Button tone="danger" onClick={() => store.dispatch({ type: 'clear' })}>
            {t('plot.clear')}
          </Button>
        </div>
      )}
    </PanelSection>
  )
}

type RoadWidthProps = { edge: number; name: string; widthM: number | null; estimated: boolean; prompt: boolean; dispatch: Dispatch }

function RoadWidth({ edge, name, widthM, estimated, prompt, dispatch }: RoadWidthProps) {
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
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
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
          aria-describedby={estimated ? `${id}-estimate` : undefined}
          onChange={(e) => {
            setText(e.target.value)
            const value = parseMetres(e.target.value)
            if (value !== null) dispatch({ type: 'set-road-width', edge, widthM: value })
          }}
          className="h-11 w-20 rounded-md border border-rule bg-paper px-2 text-right font-mono text-sm tabular-nums aria-invalid:border-signal lg:h-9"
        />
        <span className="font-mono text-sm text-slate">{t('frontage.metres')}</span>
      </div>
      {estimated && (
        <span id={`${id}-estimate`} className="text-xs text-road-ink">
          {t('frontage.estimated')}
        </span>
      )}
    </div>
  )
}

function EdgeRow({ index, edge, count, selected, dispatch }: { index: number; edge: Edge; count: number; selected: boolean; dispatch: Dispatch }) {
  const name = edgeName(index, count)
  return (
    <li
      className={`flex min-h-12 items-center gap-3 rounded-md px-2 ${selected ? 'bg-plot-wash' : ''}`}
      aria-current={selected || undefined}
    >
      <span
        className={`h-5 w-1.5 shrink-0 rounded-full ${edge.road ? 'bg-road' : 'bg-rule'}`}
        aria-hidden="true"
      />
      <span className="w-14 font-mono text-sm">{name}</span>
      {edge.road ? (
        <>
          <RoadWidth edge={index} name={name} widthM={edge.widthM} estimated={edge.estimated} prompt={selected} dispatch={dispatch} />
          <Button
            className="ml-auto"
            aria-label={t('frontage.remove-label', { edge: name })}
            onClick={() => dispatch({ type: 'unmark-road', edge: index })}
          >
            {t('frontage.remove')}
          </Button>
        </>
      ) : (
        <Button className="ml-auto" aria-label={t('frontage.mark-label', { edge: name })} onClick={() => dispatch({ type: 'mark-road', edge: index })}>
          {t('frontage.mark')}
        </Button>
      )}
    </li>
  )
}

function Frontage() {
  const store = useEditorStore()
  const { draft, selection } = useEditorState()
  if (draft.status !== 'closed') {
    return (
      <PanelSection title={t('frontage.title')}>
        <Placeholder>{t('frontage.waiting')}</Placeholder>
      </PanelSection>
    )
  }
  const roads = draft.corners.filter((c) => c.edge.road).length
  return (
    <PanelSection title={t('frontage.title')} aside={t('frontage.roads', { count: roads })}>
      <ul className="-mx-2 flex flex-col">
        {draft.corners.map((corner, index) => (
          <EdgeRow
            key={index}
            index={index}
            edge={corner.edge}
            count={draft.corners.length}
            selected={selection.kind === 'edge' && selection.index === index}
            dispatch={store.dispatch}
          />
        ))}
      </ul>
    </PanelSection>
  )
}

function BuildingTypePicker() {
  const store = useEditorStore()
  const { draft } = useEditorState()
  return (
    <PanelSection title={t('building-type.title')}>
      <fieldset className="grid grid-cols-3 gap-1 rounded-lg bg-vellum p-1">
        <legend className="sr-only">{t('building-type.title')}</legend>
        {BUILDING_TYPES.map((type) => (
          <label
            key={type}
            className="flex min-h-11 cursor-pointer items-center justify-center rounded-md px-2 text-sm font-medium text-slate transition-colors has-checked:bg-paper has-checked:text-ink has-checked:shadow-sm has-focus-visible:outline-2 has-focus-visible:outline-plot lg:min-h-9"
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
      <p className="mt-1 text-xs leading-relaxed text-slate">{t('zone.scope')}</p>
      <a
        href={BMA_CITY_PLAN_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-11 items-center text-xs text-plot underline decoration-plot/30 underline-offset-2 hover:decoration-plot lg:min-h-0 lg:pt-1.5"
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
          className="size-4 accent-plot"
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
