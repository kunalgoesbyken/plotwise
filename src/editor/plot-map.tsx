'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import type { GeoJSONSource, Map as MapLibreMap, Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { LngLat } from '@/geo/projection'
import { fitPadding, insideClearArea } from './fit-padding'
import { bindInteractions } from './map-interactions'
import { mapFeatures, mapLabels, type MapLabel } from './map-features'
import { addEditorLayers, EMPTY_OVERLAY, OVERLAY_SOURCE, PLOT_SOURCE, readPalette, type MapOverlay } from './map-layers'
import { useEditorState, useEditorStore } from './plot-store'

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'
const BANGKOK_CENTRE: LngLat = [100.5268, 13.7236]
const START_ZOOM = 17
const MAX_FIT_ZOOM = 19
const FIT_MARGIN_PX = 48
const FIT_MARGIN = { top: FIT_MARGIN_PX * 2, bottom: FIT_MARGIN_PX, left: FIT_MARGIN_PX, right: FIT_MARGIN_PX }
const PHONE_LAYOUT = '(width < 64rem)'

type View = { map: MapLibreMap; createMarker: (element: HTMLElement) => Marker }
type Covers = readonly RefObject<HTMLElement | null>[]

function paddingFor(map: MapLibreMap, covers: Covers) {
  const rects = covers.flatMap((cover) => (cover.current ? [cover.current.getBoundingClientRect()] : []))
  return fitPadding(map.getContainer().getBoundingClientRect(), rects, FIT_MARGIN)
}

function collapseAttribution(element: HTMLElement) {
  element.querySelector('.maplibregl-compact-show')?.classList.remove('maplibregl-compact-show')
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

type PlotMapProps = { covers: Covers; overlay?: MapOverlay }

export function PlotMap({ covers, overlay = EMPTY_OVERLAY }: PlotMapProps) {
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
      created.addControl(new maplibre.AttributionControl({ compact: matchMedia(PHONE_LAYOUT).matches }), 'bottom-right')
      created.on('load', () => {
        addEditorLayers(created, readPalette(element))
        unbind = bindInteractions(created, store)
        setView({ map: created, createMarker: (el) => new maplibre.Marker({ element: el, anchor: 'center' }) })
        created.once('idle', () => {
          collapseAttribution(element)
          element.setAttribute('data-map-ready', 'true')
        })
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

  useEffect(() => {
    view?.map.getSource<GeoJSONSource>(OVERLAY_SOURCE)?.setData(overlay)
  }, [view, overlay])

  const { loads } = state
  const closed = state.draft.status === 'closed'
  const ready = state.plot !== null
  const fittedLoads = useRef(0)
  useEffect(() => {
    const { draft } = store.getState()
    if (!view || draft.status !== 'closed') return
    const loaded = loads !== fittedLoads.current
    fittedLoads.current = loads
    const corners = draft.corners.map((c) => c.at)
    const padding = paddingFor(view.map, covers)
    const { clientWidth, clientHeight } = view.map.getContainer()
    if (!loaded && insideClearArea(corners.map((at) => view.map.project([...at])), clientWidth, clientHeight, padding)) return
    const lngs = corners.map(([lng]) => lng)
    const lats = corners.map(([, lat]) => lat)
    view.map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding, maxZoom: MAX_FIT_ZOOM, duration: 600 },
    )
  }, [view, loads, closed, ready, store, covers])

  return (
    <div className="absolute inset-0">
      <div ref={container} className="h-full w-full" />
    </div>
  )
}
