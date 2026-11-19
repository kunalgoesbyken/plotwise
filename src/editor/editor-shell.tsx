'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { EditorAction, EditorState } from './editor-state'
import { HintBar } from './hint-bar'
import { PlotMap } from './plot-map'
import { EditorStoreProvider, useEditorState, useEditorStore, type EditorStore } from './plot-store'
import { SitePanel } from './site-panel'
import { PanelSection, Placeholder } from './ui'

export type EditorSlots = {
  rules?: ReactNode
  designs?: ReactNode
  view3d?: ReactNode
}

const TABS = [
  { id: 'site', label: 'Site' },
  { id: 'rules', label: 'Rules' },
  { id: 'designs', label: 'Designs' },
  { id: 'view3d', label: '3D' },
] as const

type Tab = (typeof TABS)[number]['id']

const WAITING = 'Appears once the outline is closed and every road has a width.'

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
      <span className="font-display text-lg font-semibold tracking-tight">Plotwise</span>
      <span className="font-mono text-[11px] tracking-wider text-slate uppercase">Bangkok</span>
    </div>
  )
}

function Workspace({ rules, designs, view3d }: EditorSlots) {
  const store = useEditorStore()
  const state = useEditorState()
  const panel = useRef<HTMLElement>(null)
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
    <main className="relative h-dvh w-full overflow-hidden [--panel-w:24rem] 2xl:[--panel-w:27rem]">
      <PlotMap panel={panel} />
      <aside
        ref={panel}
        aria-label="Plot settings"
        className="absolute inset-x-0 bottom-0 flex max-h-[min(34rem,58dvh)] flex-col rounded-t-2xl border-t border-rule bg-paper pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-12px] shadow-ink/25 lg:inset-y-3 lg:right-3 lg:left-auto lg:max-h-none lg:w-(--panel-w) lg:rounded-xl lg:border lg:pb-0 lg:shadow-xl"
      >
        <header className="hidden border-b border-rule px-5 py-4 lg:block">
          <Wordmark />
        </header>
        <HintBar />
        <nav aria-label="Panels" className="flex shrink-0 gap-1 border-b border-rule p-1.5 lg:hidden">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              aria-pressed={open && tab === id}
              onClick={() => chooseTab(id)}
              className="min-h-11 flex-1 rounded-md font-display text-sm font-medium text-slate aria-pressed:bg-vellum aria-pressed:text-ink"
            >
              {label}
            </button>
          ))}
        </nav>
        <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${open ? '' : 'max-lg:hidden'}`}>
          <div className={shownOnPhone('site')}>
            <SitePanel />
          </div>
          <PanelSection title="Rules" className={shownOnPhone('rules')}>
            {ready && rules ? rules : <Placeholder>{WAITING}</Placeholder>}
          </PanelSection>
          <PanelSection title="Designs" className={shownOnPhone('designs')}>
            {ready && designs ? designs : <Placeholder>{WAITING}</Placeholder>}
          </PanelSection>
          <section
            aria-label="3D view"
            className={`${shownOnPhone('view3d')} max-lg:h-[42dvh] ${ready && view3d ? 'lg:fixed lg:bottom-3 lg:left-3 lg:h-[40vh] lg:w-[min(40rem,calc((100vw-var(--panel-w))*0.55))] lg:overflow-hidden lg:rounded-xl lg:border lg:border-rule lg:bg-paper lg:shadow-xl' : 'lg:hidden'}`}
          >
            {ready && view3d ? view3d : <div className="p-4"><Placeholder>{WAITING}</Placeholder></div>}
          </section>
        </div>
      </aside>
    </main>
  )
}

export function EditorShell(slots: EditorSlots) {
  return (
    <EditorStoreProvider>
      <Workspace {...slots} />
    </EditorStoreProvider>
  )
}
