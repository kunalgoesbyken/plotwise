'use client'

import { createContext, use, useDeferredValue, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { BUILDING_TYPES, type Plot } from '@/plot/plot'
import { REGIONS, type Region } from '@/region/regions'
import { initialEditorState, reduceEditor, type EditorAction, type EditorState } from './editor-state'
import { decodePlot, decodeRegion, encodePlot, encodeRegion, EXAMPLE_FRAGMENT, linkedExample } from './plot-url'
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

const LINK_PARAMS = ['rules', 'plot', 'roads', 'type', 'station', 'limits', EXAMPLE_FRAGMENT] as const

type Linked = Pick<EditorState, 'region' | 'plot'>

const fragmentFor = ({ region, plot }: Linked) => [encodeRegion(region), plot ? encodePlot(plot) : ''].filter(Boolean).join('&')

const writeUrl = (linked: Linked) => writeHash(LINK_PARAMS, fragmentFor(linked))

function syncWithUrl(store: EditorStore) {
  const loadFromUrl = () => {
    const example = linkedExample(location.hash)
    if (example) {
      store.dispatch({ type: 'set-region', region: example.region })
      store.dispatch({ type: 'load-example', plot: example.plot })
      writeUrl(store.getState())
      return
    }
    const rules = decodeRegion(location.hash)
    const link = decodePlot(location.hash)
    if (!rules.ok) {
      store.dispatch({ type: 'reject-link', problem: rules.problem })
      return
    }
    if (link?.ok === false) {
      store.dispatch({ type: 'reject-link', problem: link.problem })
      return
    }
    store.dispatch({ type: 'set-region', region: rules.region })
    if (link && fragmentFor(store.getState()) !== fragmentFor({ region: rules.region, plot: link.plot })) store.dispatch({ type: 'load', plot: link.plot })
  }
  loadFromUrl()
  let written: Linked = store.getState()
  let timer: ReturnType<typeof setTimeout> | undefined
  const unsubscribe = store.subscribe(() => {
    const state = store.getState()
    if (state.plot === written.plot && state.region === written.region) return
    written = state
    clearTimeout(timer)
    timer = setTimeout(() => writeUrl(state), URL_WRITE_DELAY_MS)
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

export function useRegion(): Region {
  const store = useEditorStore()
  const region = () => store.getState().region
  return REGIONS[useSyncExternalStore(store.subscribe, region, region)]
}

export function usePlot(): Plot | null {
  const store = useEditorStore()
  const plot = useSyncExternalStore(store.subscribe, () => store.getState().plot, () => store.getState().plot)
  return useDeferredValue(plot)
}
