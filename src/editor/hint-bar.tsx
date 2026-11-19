'use client'

import type { ReactNode } from 'react'
import { nextStep, type EditorState } from './editor-state'
import { cornerName, edgeName } from './map-features'
import { MAX_CORNERS, type Rejection } from './plot-draft'
import { useEditorState, useEditorStore } from './plot-store'
import { Button, Click } from './ui'

const REJECTIONS: Record<Rejection, string> = {
  crossing: 'Edges can’t cross or overlap. Try another point.',
  degenerate: 'These corners are too close together or all in a line to make a plot.',
  'out-of-range': 'That point is too far from the rest of the plot.',
  'too-few-corners': 'A plot needs at least 3 corners.',
  'too-many-corners': `A plot can have up to ${MAX_CORNERS} corners.`,
}

type Hint = { label: string; text: ReactNode; alert?: boolean }

function hintFor(state: EditorState): Hint {
  const { draft, selection, notice } = state
  if (notice) return { label: 'Not allowed', text: REJECTIONS[notice], alert: true }
  if (selection.kind === 'corner' && draft.status === 'closed') {
    return { label: `Corner ${cornerName(selection.index)}`, text: 'Drag to move it, or delete it.' }
  }
  const step = nextStep(state)
  const count = draft.status === 'closed' ? draft.corners.length : 0
  switch (step.step) {
    case 'start':
      return { label: 'Outline', text: <><Click /> the map to place the first corner of the plot.</> }
    case 'place':
      return { label: 'Outline', text: <><Click /> to place the next corner.</> }
    case 'close':
      return { label: 'Outline', text: <><Click /> corner A to close the outline.</> }
    case 'road':
      return { label: 'Frontage', text: <><Click /> each edge that faces a road.</> }
    case 'width':
      return { label: 'Frontage', text: `Enter the width of the road on edge ${edgeName(step.edge, count)}.` }
    case 'done':
      return { label: 'Ready', text: 'Drag a corner to reshape the plot. Drag an edge’s midpoint to add a corner.' }
  }
}

export function HintBar() {
  const store = useEditorStore()
  const state = useEditorState()
  const { draft, selection } = state
  const hint = hintFor(state)
  const drawing = draft.status === 'drawing' && draft.points.length > 0

  return (
    <div className="shrink-0 p-1.5 pb-0 lg:pointer-events-none lg:fixed lg:top-3 lg:left-3 lg:max-w-[min(38rem,calc(100vw-var(--panel-w)-7rem))] lg:p-0">
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-ink py-2 pr-2 pl-3 text-paper shadow-lg shadow-ink/20"
      >
        <span className={`font-mono text-[11px] tracking-wider uppercase ${hint.alert ? 'text-road' : 'text-paper/60'}`}>
          {hint.label}
        </span>
        <p className="min-w-0 flex-1 basis-48 text-sm leading-snug">{hint.text}</p>
        {drawing && (
          <div className="flex gap-1.5">
            <Button tone="inverse" onClick={() => store.dispatch({ type: 'undo' })}>
              Undo corner
            </Button>
            {draft.points.length >= 3 && (
              <Button tone="inverse" onClick={() => store.dispatch({ type: 'close' })}>
                Close outline
              </Button>
            )}
          </div>
        )}
        {selection.kind === 'corner' && draft.status === 'closed' && (
          <Button tone="inverse" onClick={() => store.dispatch({ type: 'remove', corner: selection.index })}>
            Delete corner
          </Button>
        )}
      </div>
    </div>
  )
}
