'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { BUILDING_TYPES, type BuildingType } from '@/plot/plot'
import { loadPack } from '@/rules'
import { stationDistance } from '@/solve'
import type { EditorAction } from './editor-state'
import { EXAMPLE_PLOT } from './example-plot'
import { edgeName } from './map-features'
import { parseMetres } from './metres'
import type { Edge } from './outline'
import { useEditorState, useEditorStore } from './plot-store'
import { Button, Click, PanelSection, Placeholder } from './ui'

const BUILDING_TYPE_NAMES: Record<BuildingType, string> = {
  condo: 'Condominium',
  office: 'Office',
  hotel: 'Hotel',
}

const STATION_DISTANCE_M = stationDistance(loadPack('bkk-y9')).value

type Dispatch = (action: EditorAction) => void

function PlotOutline() {
  const store = useEditorStore()
  const { draft } = useEditorState()
  const count = draft.status === 'closed' ? draft.corners.length : draft.points.length
  const empty = draft.status === 'drawing' && count === 0

  return (
    <PanelSection title="Plot" aside={empty ? undefined : `${count} ${count === 1 ? 'corner' : 'corners'}`}>
      {empty ? (
        <div className="flex flex-col items-start gap-3">
          <Placeholder>
            <Click /> the map at each corner of the plot boundary, then close the outline on the first corner.
          </Placeholder>
          <Button onClick={() => store.dispatch({ type: 'load', plot: EXAMPLE_PLOT })}>Use an example plot</Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <p className="mr-auto text-sm">{draft.status === 'closed' ? 'Outline closed' : 'Drawing the outline'}</p>
          <Button tone="danger" onClick={() => store.dispatch({ type: 'clear' })}>
            Clear and redraw
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
          Road width on edge {name}, in metres
        </label>
        <input
          ref={input}
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="width"
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
        <span className="font-mono text-sm text-slate">m</span>
      </div>
      {estimated && (
        <span id={`${id}-estimate`} className="text-xs text-road-ink">
          Estimated from OpenStreetMap. Check it on site.
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
            aria-label={`Remove road on edge ${name}`}
            onClick={() => dispatch({ type: 'unmark-road', edge: index })}
          >
            Remove
          </Button>
        </>
      ) : (
        <Button className="ml-auto" aria-label={`Mark edge ${name} as a road`} onClick={() => dispatch({ type: 'mark-road', edge: index })}>
          Mark as road
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
      <PanelSection title="Road frontage">
        <Placeholder>Close the outline, then mark the edges that face a road.</Placeholder>
      </PanelSection>
    )
  }
  const roads = draft.corners.filter((c) => c.edge.road).length
  return (
    <PanelSection title="Road frontage" aside={`${roads} ${roads === 1 ? 'road' : 'roads'}`}>
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
    <PanelSection title="Building type">
      <fieldset className="grid grid-cols-3 gap-1 rounded-lg bg-vellum p-1">
        <legend className="sr-only">Building type</legend>
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
            {BUILDING_TYPE_NAMES[type]}
          </label>
        ))}
      </fieldset>
    </PanelSection>
  )
}

function StationToggle() {
  const store = useEditorStore()
  const { draft } = useEditorState()
  return (
    <PanelSection title="Mass transit">
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm lg:min-h-9">
        <input
          type="checkbox"
          checked={draft.nearStation}
          onChange={(e) => store.dispatch({ type: 'set-near-station', nearStation: e.target.checked })}
          className="size-4 accent-plot"
        />
        Within {STATION_DISTANCE_M} m of a BTS/MRT station
      </label>
    </PanelSection>
  )
}

export function SitePanel() {
  return (
    <>
      <PlotOutline />
      <Frontage />
      <BuildingTypePicker />
      <StationToggle />
    </>
  )
}
