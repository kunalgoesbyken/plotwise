'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { t } from '@/text/messages'
import type { EditorAction, EditorState } from './editor-state'
import { HintBar } from './hint-bar'
import type { MapOverlay } from './map-layers'
import { PlotMap } from './plot-map'
import { useEditorState, useEditorStore, type EditorStore } from './plot-store'
import { SitePanel } from './site-panel'
import { PanelSection, Placeholder, SEGMENT, SEGMENTS } from './ui'

export type EditorSlots = {
  summary?: ReactNode
  rules?: ReactNode
  designs?: ReactNode
  view3d?: ReactNode
  overlay?: MapOverlay
}

const TABS = ['site', 'rules', 'designs', 'view3d'] as const

type Tab = (typeof TABS)[number]

const INTERACTIVE = 'input, select, textarea, button, a[href], [contenteditable]'

function isOnControl(target: EventTarget | null) {
  return target instanceof Element && target.closest(INTERACTIVE) !== null
}

function shortcut(key: string, { draft, selection }: EditorState): EditorAction | null {
  if (key === 'Escape') return { type: 'select', selection: { kind: 'none' } }
  if (key === 'Enter' && draft.status === 'drawing') return { type: 'close' }
  if (key !== 'Backspace' && key !== 'Delete') return null
  if (draft.status === 'drawing') return { type: 'undo' }
  if (selection.kind === 'corner') return { type: 'remove', corner: selection.index }
  if (selection.kind === 'edge') return { type: 'unmark-road', edge: selection.index }
  return null
}

function useShortcuts(store: EditorStore) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isOnControl(event.target)) return
      const action = shortcut(event.key, store.getState())
      if (!action) return
      event.preventDefault()
      store.dispatch(action)
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [store])
}

function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
        <path d="M4 8 L14 3 L21 9 L18 20 L6 19 Z" fill="none" className="stroke-plot" strokeWidth="1.75" strokeLinejoin="round" />
        <path d="M6 19 L18 20" className="stroke-road" strokeWidth="3.5" strokeLinecap="round" />
      </svg>
      <span className="font-display text-lg leading-none font-semibold tracking-tight">{t('app.name')}</span>
      <span className="text-sm leading-none text-slate">{t('app.city')}</span>
    </div>
  )
}

export function EditorShell({ summary, rules, designs, view3d, overlay }: EditorSlots) {
  const store = useEditorStore()
  const state = useEditorState()
  const panel = useRef<HTMLElement>(null)
  const inset = useRef<HTMLElement>(null)
  const covers = useMemo(() => [panel, inset], [])
  const [tab, setTab] = useState<Tab>('site')
  const [open, setOpen] = useState(true)
  useShortcuts(store)

  const selectedEdge = state.selection.kind === 'edge' ? state.selection.index : null
  const [shownEdge, setShownEdge] = useState(selectedEdge)
  if (shownEdge !== selectedEdge) {
    setShownEdge(selectedEdge)
    if (selectedEdge !== null) {
      setTab('site')
      setOpen(true)
    }
  }

  const ready = state.plot !== null
  const shownOnPhone = (id: Tab) => (tab === id ? '' : 'max-lg:hidden')
  const chooseTab = (id: Tab) => {
    setOpen(id !== tab || !open)
    setTab(id)
  }

  return (
    <main className="relative h-dvh w-full overflow-clip [--panel-w:24rem] 2xl:[--panel-w:27rem]">
      <PlotMap covers={covers} overlay={overlay} />
      <aside
        ref={panel}
        aria-label={t('shell.panel')}
        className="absolute inset-x-0 bottom-0 z-10 flex max-h-[min(36rem,64dvh)] flex-col rounded-t-2xl border-t border-rule bg-paper pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-12px] shadow-ink/25 [--pad:1rem] md:inset-x-auto md:bottom-3 md:left-3 md:w-[26rem] md:rounded-2xl md:border md:pb-0 md:shadow-xl lg:inset-y-3 lg:right-3 lg:left-auto lg:max-h-none lg:w-(--panel-w) lg:rounded-xl lg:[--pad:1.25rem]"
      >
        <header className="hidden h-14 shrink-0 items-center border-b border-rule px-(--pad) lg:flex">
          <Wordmark />
        </header>
        <HintBar />
        <nav aria-label={t('shell.tabs')} className={`${SEGMENTS} mx-2 my-2 shrink-0 grid-cols-4 lg:hidden`}>
          {TABS.map((id) => (
            <button key={id} type="button" aria-pressed={open && tab === id} onClick={() => chooseTab(id)} className={`${SEGMENT} font-display text-sm`}>
              {t(`tab.${id}`)}
            </button>
          ))}
        </nav>
        <div className={`thin-scroll min-h-0 flex-1 scroll-pt-28 overflow-y-auto overscroll-contain ${open ? '' : 'max-lg:hidden'}`}>
          {ready && summary && (
            <div className={`sticky top-0 z-10 -mb-px border-b border-rule bg-paper px-(--pad) py-3 ${tab === 'view3d' ? 'max-lg:hidden' : ''}`}>{summary}</div>
          )}
          <div className={shownOnPhone('site')}>
            <SitePanel />
          </div>
          <PanelSection title={t('tab.rules')} className={shownOnPhone('rules')}>
            {ready && rules ? rules : <Placeholder>{t('shell.waiting.rules')}</Placeholder>}
          </PanelSection>
          <PanelSection title={t('tab.designs')} className={shownOnPhone('designs')}>
            {ready && designs ? designs : <Placeholder>{t('shell.waiting.designs')}</Placeholder>}
          </PanelSection>
          <section
            ref={inset}
            aria-label={t('section.view3d')}
            className={`${shownOnPhone('view3d')} max-lg:h-[50dvh] ${ready && view3d ? 'lg:fixed lg:bottom-3 lg:left-3 lg:h-[48vh] lg:w-[min(40rem,calc((100vw-var(--panel-w))*0.5))] lg:overflow-hidden lg:rounded-xl lg:border lg:border-rule lg:bg-paper lg:shadow-xl' : 'lg:hidden'}`}
          >
            {ready && view3d ? (
              view3d
            ) : (
              <div className="px-(--pad) py-5">
                <Placeholder>{t('shell.waiting.view3d')}</Placeholder>
              </div>
            )}
          </section>
        </div>
      </aside>
    </main>
  )
}
