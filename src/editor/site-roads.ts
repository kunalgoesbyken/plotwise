import { bboxQuery, plotSiteBbox, snapBbox } from '@/site/bbox'
import { fetchSite } from '@/site/client'
import type { EditorStore } from './plot-store'

export function syncSiteRoads(store: EditorStore) {
  let requested = ''
  let pending: AbortController | undefined

  const refresh = () => {
    const { draft } = store.getState()
    if (draft.status !== 'closed') return
    const bbox = plotSiteBbox(draft.corners.map((c) => c.at))
    const key = bboxQuery(snapBbox(bbox))
    if (key === requested) return
    requested = key
    pending?.abort()
    const controller = new AbortController()
    pending = controller
    fetchSite(bbox, { signal: controller.signal })
      .then((site) => store.dispatch({ type: 'site-roads', roads: site.roads }))
      .catch(() => store.dispatch({ type: 'site-roads', roads: [] }))
  }

  refresh()
  const unsubscribe = store.subscribe(refresh)
  return () => {
    unsubscribe()
    pending?.abort()
  }
}
