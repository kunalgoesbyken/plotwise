'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import type { GeoJSONSource, Map as MapLibreMap, Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { LngLat } from '@/geo/projection'
import { bindInteractions } from './map-interactions'
import { mapFeatures, mapLabels, type MapLabel } from './map-features'
import { addEditorLayers, PLOT_SOURCE, readPalette } from './map-layers'
import { useEditorState, useEditorStore } from './plot-store'

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'
const BANGKOK_CENTRE: LngLat = [100.5268, 13.7236]
const START_ZOOM = 17
const MAX_FIT_ZOOM = 19
const FIT_MARGIN_PX = 48

type View = { map: MapLibreMap; createMarker: (element: HTMLElement) => Marker }

function fitPadding(map: MapLibreMap, panel: HTMLElement | null) {
  const frame = map.getContainer().getBoundingClientRect()
  const covered = panel?.getBoundingClientRect()
  const padding = { top: FIT_MARGIN_PX * 2, bottom: FIT_MARGIN_PX, left: FIT_MARGIN_PX, right: FIT_MARGIN_PX }
  if (!covered || covered.width === 0) return padding
  const besidePanel = covered.left > frame.left + frame.width / 2
  return besidePanel
    ? { ...padding, right: frame.right - covered.left + FIT_MARGIN_PX }
    : { ...padding, bottom: frame.bottom - covered.top + FIT_MARGIN_PX }
}

function labelElement(label: MapLabel) {
  const element = document.createElement('div')
  element.className = `map-label map-label-${label.kind}`
  element.setAttribute('aria-hidden', 'true')
  return element
}

function syncLabels(view: View, markers: Map<string, Marker>, labels: MapLabel[]) {
  const wanted = new Set(labels.map((l) => l.id))
  for (const [id, marker] of markers) {
    if (wanted.has(id)) continue
    marker.remove()
    markers.delete(id)
  }
  for (const label of labels) {
    const existing = markers.get(label.id)
    const marker = (existing ?? view.createMarker(labelElement(label))).setLngLat([...label.at])
    marker.getElement().textContent = label.text
    if (existing) continue
    marker.addTo(view.map)
    markers.set(label.id, marker)
  }
}

export function PlotMap({ panel }: { panel: RefObject<HTMLElement | null> }) {
  const store = useEditorStore()
  const state = useEditorState()
  const container = useRef<HTMLDivElement>(null)
  const markers = useRef(new Map<string, Marker>())
  const [view, setView] = useState<View | null>(null)

  useEffect(() => {
    let map: MapLibreMap | undefined
    let unbind: (() => void) | undefined
    let cancelled = false
    import('maplibre-gl').then((maplibre) => {
      const element = container.current
      if (cancelled || !element) return
      maplibre.setWorkerUrl(new URL('/maplibre-gl-worker.mjs', location.origin).href)
      const created = new maplibre.Map({
        container: element,
        style: STYLE_URL,
        center: [...BANGKOK_CENTRE],
        zoom: START_ZOOM,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        doubleClickZoom: false,
      })
      map = created
      created.touchZoomRotate.disableRotation()
      created.keyboard.disableRotation()
      created.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right')
      created.addControl(new maplibre.ScaleControl({ unit: 'metric' }), 'bottom-right')
      created.addControl(new maplibre.AttributionControl(), 'bottom-right')
      created.on('load', () => {
        addEditorLayers(created, readPalette(element))
        unbind = bindInteractions(created, store)
        setView({ map: created, createMarker: (el) => new maplibre.Marker({ element: el, anchor: 'center' }) })
        created.once('idle', () => element.setAttribute('data-map-ready', 'true'))
      })
    })
    return () => {
      cancelled = true
      unbind?.()
      map?.remove()
    }
  }, [store])

  useEffect(() => {
    if (!view) return
    view.map.getSource<GeoJSONSource>(PLOT_SOURCE)?.setData(mapFeatures(state))
    syncLabels(view, markers.current, mapLabels(state.draft))
  }, [view, state])

  const { loads } = state
  useEffect(() => {
    const { draft } = store.getState()
    if (!view || loads === 0 || draft.status !== 'closed') return
    const lngs = draft.corners.map((c) => c.at[0])
    const lats = draft.corners.map((c) => c.at[1])
    view.map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: fitPadding(view.map, panel.current), maxZoom: MAX_FIT_ZOOM, duration: 600 },
    )
  }, [view, loads, store, panel])

  return (
    <div className="absolute inset-0">
      <div ref={container} className="h-full w-full" />
    </div>
  )
}
