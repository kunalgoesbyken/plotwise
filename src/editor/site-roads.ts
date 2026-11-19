import { localFrame, type LngLat } from '@/geo/projection'
import { NEAREST_ROAD_MAX_GAP_M } from '@/site/assumptions'
import { bboxQuery, snapBbox, type Bbox } from '@/site/bbox'
import { fetchSite } from '@/site/client'
import type { EditorStore } from './plot-store'

const SEARCH_MARGIN_M = 2 * NEAREST_ROAD_MAX_GAP_M.value

export function roadSearchBbox(ring: readonly LngLat[]): Bbox {
  const frame = localFrame(ring[0])
  const local = ring.map((p) => frame.toLocal(p))
  const xs = local.map(([x]) => x)
  const ys = local.map(([, y]) => y)
  const [minLng, minLat] = frame.toLngLat([Math.min(...xs) - SEARCH_MARGIN_M, Math.min(...ys) - SEARCH_MARGIN_M])
  const [maxLng, maxLat] = frame.toLngLat([Math.max(...xs) + SEARCH_MARGIN_M, Math.max(...ys) + SEARCH_MARGIN_M])
  return [minLng, minLat, maxLng, maxLat]
}

export function syncSiteRoads(store: EditorStore) {
  let requested = ''
  let pending: AbortController | undefined

  const refresh = () => {
    const { draft } = store.getState()
    if (draft.status !== 'closed') return
    const bbox = roadSearchBbox(draft.corners.map((c) => c.at))
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
