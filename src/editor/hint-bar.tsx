'use client'

import type { ReactNode } from 'react'
import { t } from '@/text/messages'
import { nextStep, type EditorState } from './editor-state'
import { cornerName, edgeName } from './map-features'
import { MAX_CORNERS, type Rejection } from './plot-draft'
import { useEditorState, useEditorStore } from './plot-store'
import { Button, PointerText } from './ui'

function rejection(reason: Rejection): string {
  return reason === 'too-many-corners' ? t('rejection.too-many-corners', { count: MAX_CORNERS }) : t(`rejection.${reason}`)
}

type Hint = { label: string; text: ReactNode; alert?: boolean; settled?: boolean }

function hintFor(state: EditorState): Hint {
  const { draft, selection, notice } = state
  if (notice) return { label: t('hint.label.not-allowed'), text: rejection(notice), alert: true }
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
    <div className={`shrink-0 px-2 pt-2 ${hint.settled ? 'max-lg:hidden' : ''} lg:pointer-events-none lg:fixed lg:top-3 lg:left-3 lg:max-w-[min(38rem,calc(100vw-var(--panel-w)-7rem))] lg:p-0`}>
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex min-h-12 flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-ink py-2 pr-2 pl-3.5 text-paper shadow-lg shadow-ink/20"
      >
        <span className={`font-mono text-2xs tracking-wider uppercase ${hint.alert ? 'text-road' : 'text-paper/60'}`}>
          {hint.label}
        </span>
        <p className="min-w-0 flex-1 basis-48 text-sm leading-snug text-pretty">{hint.text}</p>
        {drawing && (
          <div className="flex gap-1.5">
            <Button tone="inverse" onClick={() => store.dispatch({ type: 'undo' })}>
              {t('action.undo-corner')}
            </Button>
            {draft.points.length >= 3 && (
              <Button tone="inverse" onClick={() => store.dispatch({ type: 'close' })}>
                {t('action.close-outline')}
              </Button>
            )}
          </div>
        )}
        {selection.kind === 'corner' && draft.status === 'closed' && (
          <Button tone="inverse" onClick={() => store.dispatch({ type: 'remove', corner: selection.index })}>
            {t('action.delete-corner')}
          </Button>
        )}
      </div>
    </div>
  )
}
