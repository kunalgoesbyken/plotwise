'use client'

import type { ReactNode } from 'react'
import { t } from '@/text/messages'
import { nextStep, type EditorState, type Notice } from './editor-state'
import { cornerName, edgeName } from './map-features'
import { MAX_CORNERS } from './plot-draft'
import { useEditorState, useEditorStore } from './plot-store'
import { Button } from '@/ui/button'
import { PointerText } from './ui'

function rejection(reason: Notice): string {
  return reason === 'too-many-corners' ? t('rejection.too-many-corners', { count: MAX_CORNERS }) : t(`rejection.${reason}`)
}

type Hint = { label: string; text: ReactNode; alert?: boolean; settled?: boolean }

function hintFor(state: EditorState): Hint {
  const { draft, selection, notice } = state
  if (notice) return { label: t('hint.label.notice'), text: rejection(notice), alert: true }
  if (selection.kind === 'corner' && draft.status === 'closed') {
    return { label: t('hint.label.corner', { name: cornerName(selection.index) }), text: t('hint.corner') }
  }
  const step = nextStep(state)
  const count = draft.status === 'closed' ? draft.corners.length : 0
  switch (step.step) {
    case 'start':
      return { label: t('hint.label.outline'), text: <PointerText text={(verb) => t('hint.start', { verb })} /> }
    case 'place':
      return { label: t('hint.label.outline'), text: <PointerText text={(verb) => t('hint.place', { verb })} /> }
    case 'close':
      return { label: t('hint.label.outline'), text: <PointerText text={(verb) => t('hint.close', { verb })} /> }
    case 'road':
      return { label: t('hint.label.frontage'), text: <PointerText text={(verb) => t('hint.road', { verb })} /> }
    case 'width':
      return { label: t('hint.label.frontage'), text: t('hint.width', { edge: edgeName(step.edge, count) }) }
    case 'done':
      return { label: t('hint.label.ready'), text: t('hint.done'), settled: true }
  }
}

export function HintBar() {
  const store = useEditorStore()
  const state = useEditorState()
  const { draft, selection } = state
  const hint = hintFor(state)
  const drawing = draft.status === 'drawing' && draft.points.length > 0

  return (
    <div className={`flex shrink-0 flex-col items-start gap-2 px-2 pt-2 ${hint.settled ? 'max-lg:hidden' : ''} lg:pointer-events-none lg:fixed lg:top-3 lg:left-3 lg:max-w-[min(38rem,calc(100vw-var(--panel-w)-7rem))] lg:p-0`}>
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex min-h-12 w-full flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-foreground py-2 pr-2 pl-3.5 text-background shadow-lg shadow-foreground/20"
      >
        <span className={`text-2xs tracking-wider uppercase ${hint.alert ? 'text-road' : 'text-background/60'}`}>
          {hint.label}
        </span>
        <p className="min-w-0 flex-1 basis-48 text-sm leading-snug text-pretty">{hint.text}</p>
        {drawing && (
          <div className="flex gap-1.5">
            <Button variant="secondary" size="sm" onClick={() => store.dispatch({ type: 'undo' })}>
              {t('action.undo-corner')}
            </Button>
            {draft.points.length >= 3 && (
              <Button variant="secondary" size="sm" onClick={() => store.dispatch({ type: 'close' })}>
                {t('action.close-outline')}
              </Button>
            )}
          </div>
        )}
        {selection.kind === 'corner' && draft.status === 'closed' && (
          <Button variant="secondary" size="sm" onClick={() => store.dispatch({ type: 'remove', corner: selection.index })}>
            {t('action.delete-corner')}
          </Button>
        )}
      </div>
      {hint.settled && <MapLegend />}
    </div>
  )
}

const LEGEND = [
  { key: 'legend.road', swatch: 'h-1 w-4 rounded-full bg-road' },
  { key: 'legend.buildable', swatch: 'size-3.5 rounded-xs border border-dashed border-primary bg-primary/15' },
  { key: 'legend.footprint', swatch: 'size-3.5 rounded-xs bg-foreground/25 ring-1 ring-foreground/60' },
] as const

function MapLegend() {
  return (
    <ul aria-label={t('legend.label')} className="flex flex-wrap gap-x-4 gap-y-1 rounded-lg border bg-background/95 px-3 py-2 text-xs shadow-sm max-lg:hidden">
      {LEGEND.map(({ key, swatch }) => (
        <li key={key} className="flex items-center gap-2">
          <span aria-hidden="true" className={swatch} />
          {t(key)}
        </li>
      ))}
    </ul>
  )
}
