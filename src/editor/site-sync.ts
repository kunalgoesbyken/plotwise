import { plotSiteBbox } from '@/site/bbox'
import { loadSharedSite, siteCell } from '@/site/shared-site'
import type { EditorStore } from './plot-store'

export function syncSite(store: EditorStore) {
  let requested = ''
  let pending: AbortController | undefined

  const refresh = () => {
    const { draft, region } = store.getState()
    if (draft.status !== 'closed') return
    const bbox = plotSiteBbox(draft.corners.map((c) => c.at))
    const key = siteCell(bbox, region)
    if (key === requested) return
    requested = key
    pending?.abort()
    const controller = new AbortController()
    pending = controller
    loadSharedSite(bbox, region, { signal: controller.signal })
      .then((site) => store.dispatch({ type: 'site', roads: site.roads, stations: site.stations }))
      .catch(() => store.dispatch({ type: 'site', roads: [], stations: null }))
  }

  refresh()
  const unsubscribe = store.subscribe(refresh)
  return () => {
    unsubscribe()
    pending?.abort()
  }
}
