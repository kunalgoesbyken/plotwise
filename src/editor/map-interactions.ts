import type { GeoJSONSource, Map as MapLibreMap, MapMouseEvent, MapTouchEvent } from 'maplibre-gl'
import type { LngLat } from '@/geo/projection'
import { pickTarget, type Hit } from './map-hit'
import { PREVIEW_SOURCE } from './map-layers'
import { roundLngLat, type Draft } from './plot-draft'
import type { EditorStore } from './plot-store'

const MOUSE_REACH_PX = 10
const TOUCH_REACH_PX = 22

type PointerEvent = MapMouseEvent | MapTouchEvent

type Drag = { kind: 'corner'; index: number } | { kind: 'new-corner'; edge: number }

function lngLatOf(event: PointerEvent): LngLat {
  return roundLngLat([event.lngLat.lng, event.lngLat.lat])
}

function vertices(draft: Draft) {
  return draft.status === 'drawing' ? draft.points : draft.corners.map((c) => c.at)
}

function hitAt(map: MapLibreMap, draft: Draft, event: PointerEvent): Hit | null {
  const reach = 'touches' in event.originalEvent ? TOUCH_REACH_PX : MOUSE_REACH_PX
  const pixels = vertices(draft).map((at) => {
    const { x, y } = map.project([...at])
    return [x, y] as const
  })
  return pickTarget(pixels, draft.status === 'closed', [event.point.x, event.point.y], reach)
}

function cursorFor(hit: Hit | null, drawing: boolean) {
  if (drawing) return hit?.kind === 'corner' && hit.index === 0 ? 'pointer' : 'crosshair'
  if (hit?.kind === 'corner') return 'grab'
  if (hit?.kind === 'midpoint') return 'copy'
  return hit?.kind === 'edge' ? 'pointer' : ''
}

export function bindInteractions(map: MapLibreMap, store: EditorStore) {
  let drag: Drag | null = null
  const canvas = map.getCanvas()

  const showPreview = (to: LngLat | null) => {
    const { draft } = store.getState()
    const from = draft.status === 'drawing' ? draft.points.at(-1) : undefined
    const features: GeoJSON.Feature[] =
      from && to ? [{ type: 'Feature', geometry: { type: 'LineString', coordinates: [[...from], [...to]] }, properties: {} }] : []
    map.getSource<GeoJSONSource>(PREVIEW_SOURCE)?.setData({ type: 'FeatureCollection', features })
  }

  const onDown = (event: PointerEvent) => {
    if ('points' in event && event.points.length !== 1) return
    const { draft } = store.getState()
    if (draft.status !== 'closed') return
    const hit = hitAt(map, draft, event)
    if (hit?.kind === 'corner') {
      store.dispatch({ type: 'select', selection: { kind: 'corner', index: hit.index } })
      drag = { kind: 'corner', index: hit.index }
    } else if (hit?.kind === 'midpoint') {
      drag = { kind: 'new-corner', edge: hit.edge }
    } else return
    event.preventDefault()
    canvas.style.cursor = 'grabbing'
  }

  const dragTo = (current: Drag, at: LngLat) => {
    if (current.kind === 'corner') {
      store.dispatch({ type: 'move', corner: current.index, at })
      return
    }
    const before = store.getState().draft
    store.dispatch({ type: 'insert', edge: current.edge, at })
    if (store.getState().draft !== before) drag = { kind: 'corner', index: current.edge + 1 }
  }

  const onMove = (event: PointerEvent) => {
    if (drag) {
      dragTo(drag, lngLatOf(event))
      return
    }
    const { draft } = store.getState()
    const drawing = draft.status === 'drawing'
    canvas.style.cursor = cursorFor(hitAt(map, draft, event), drawing)
    if (drawing) showPreview(lngLatOf(event))
  }

  const onUp = () => {
    if (!drag) return
    drag = null
    canvas.style.cursor = 'grab'
    store.dispatch({ type: 'settle' })
  }

  const onClick = (event: MapMouseEvent) => {
    const { draft } = store.getState()
    const hit = hitAt(map, draft, event)
    if (draft.status === 'drawing') {
      const closing = hit?.kind === 'corner' && hit.index === 0 && draft.points.length >= 3
      store.dispatch(closing ? { type: 'close' } : { type: 'add', at: lngLatOf(event) })
      showPreview(closing ? null : lngLatOf(event))
      return
    }
    if (hit?.kind === 'edge') {
      const isRoad = draft.corners[hit.index]?.edge.road
      store.dispatch(isRoad ? { type: 'select', selection: { kind: 'edge', index: hit.index } } : { type: 'mark-road', edge: hit.index })
      return
    }
    if (!hit) store.dispatch({ type: 'select', selection: { kind: 'none' } })
  }

  const onLeave = () => showPreview(null)

  map.on('mousedown', onDown)
  map.on('touchstart', onDown)
  map.on('mousemove', onMove)
  map.on('touchmove', onMove)
  map.on('mouseup', onUp)
  map.on('touchend', onUp)
  map.on('click', onClick)
  map.on('mouseout', onLeave)
  addEventListener('pointerup', onUp)
  return () => {
    removeEventListener('pointerup', onUp)
    map.off('mousedown', onDown)
    map.off('touchstart', onDown)
    map.off('mousemove', onMove)
    map.off('touchmove', onMove)
    map.off('mouseup', onUp)
    map.off('touchend', onUp)
    map.off('click', onClick)
    map.off('mouseout', onLeave)
  }
}
