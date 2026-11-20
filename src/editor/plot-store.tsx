'use client'

import { createContext, use, useDeferredValue, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { EXAMPLE_PLOT } from '@/plot/example-plot'
import { BUILDING_TYPES, type Plot } from '@/plot/plot'
import { initialEditorState, reduceEditor, type EditorAction, type EditorState } from './editor-state'
import { decodePlot, encodePlot, EXAMPLE_FRAGMENT, isExampleLink } from './plot-url'
import { syncSite } from './site-sync'
import { writeHash } from './url-hash'

const URL_WRITE_DELAY_MS = 300

export type EditorStore = {
  getState: () => EditorState
  dispatch: (action: EditorAction) => void
  subscribe: (listener: () => void) => () => void
}

function createEditorStore(): EditorStore {
  let state = initialEditorState(BUILDING_TYPES[0])
  const listeners = new Set<() => void>()
  return {
    getState: () => state,
    dispatch(action) {
      const next = reduceEditor(state, action)
      if (next === state) return
      state = next
      listeners.forEach((listener) => listener())
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

const PLOT_PARAMS = ['plot', 'roads', 'type', 'station', EXAMPLE_FRAGMENT] as const

const fragmentFor = (plot: Plot | null) => (plot ? encodePlot(plot) : '')

const writeUrl = (plot: Plot | null) => writeHash(PLOT_PARAMS, fragmentFor(plot))

function syncWithUrl(store: EditorStore) {
  const loadFromUrl = () => {
    if (isExampleLink(location.hash)) {
      store.dispatch({ type: 'load-example', plot: EXAMPLE_PLOT })
      writeUrl(store.getState().plot)
      return
    }
    const link = decodePlot(location.hash)
    if (!link) return
    if (!link.ok) {
      store.dispatch({ type: 'reject-link', problem: link.problem })
      return
    }
    if (fragmentFor(store.getState().plot) !== encodePlot(link.plot)) store.dispatch({ type: 'load', plot: link.plot })
  }
  loadFromUrl()
  let written = store.getState().plot
  let timer: ReturnType<typeof setTimeout> | undefined
  const unsubscribe = store.subscribe(() => {
    const { plot } = store.getState()
    if (plot === written) return
    written = plot
    clearTimeout(timer)
    timer = setTimeout(() => writeUrl(plot), URL_WRITE_DELAY_MS)
  })
  addEventListener('hashchange', loadFromUrl)
  return () => {
    unsubscribe()
    clearTimeout(timer)
    removeEventListener('hashchange', loadFromUrl)
  }
}

const EditorStoreContext = createContext<EditorStore | null>(null)

export function EditorStoreProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createEditorStore)
  useEffect(() => syncWithUrl(store), [store])
  useEffect(() => syncSite(store), [store])
  return <EditorStoreContext value={store}>{children}</EditorStoreContext>
}

export function useEditorStore() {
  const store = use(EditorStoreContext)
  if (!store) throw new Error('useEditorStore must be used inside EditorStoreProvider')
  return store
}

export function useEditorState() {
  const store = useEditorStore()
  return useSyncExternalStore(store.subscribe, store.getState, store.getState)
}

export function usePlot(): Plot | null {
  const store = useEditorStore()
  const plot = useSyncExternalStore(store.subscribe, () => store.getState().plot, () => store.getState().plot)
  return useDeferredValue(plot)
}
