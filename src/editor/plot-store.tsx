'use client'

import { createContext, use, useDeferredValue, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { BUILDING_TYPES, type Plot } from '@/plot/plot'
import { initialEditorState, reduceEditor, type EditorAction, type EditorState } from './editor-state'
import { decodePlot, encodePlot } from './plot-url'
import { syncSiteRoads } from './site-roads'

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

function fragmentFor(plot: Plot | null) {
  return plot ? `#${encodePlot(plot)}` : ''
}

function writeUrl(plot: Plot | null) {
  const fragment = fragmentFor(plot)
  if (location.hash === fragment) return
  history.replaceState(null, '', `${location.pathname}${location.search}${fragment}`)
}

function syncWithUrl(store: EditorStore) {
  const loadFromUrl = () => {
    const plot = decodePlot(location.hash)
    if (plot && fragmentFor(store.getState().plot) !== location.hash) store.dispatch({ type: 'load', plot })
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
  useEffect(() => syncSiteRoads(store), [store])
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
