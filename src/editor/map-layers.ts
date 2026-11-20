import type { ExpressionSpecification, Map as MapLibreMap } from 'maplibre-gl'

export const PLOT_SOURCE = 'plotwise-plot'
export const PREVIEW_SOURCE = 'plotwise-preview'
export const OVERLAY_SOURCE = 'plotwise-overlay'

export type OverlayKind = 'envelope' | 'building'
export type MapOverlay = GeoJSON.FeatureCollection<GeoJSON.MultiPolygon, { kind: OverlayKind }>

export const EMPTY_OVERLAY: MapOverlay = { type: 'FeatureCollection', features: [] }

export const LAYERS = {
  envelope: 'plotwise-envelope',
  envelopeOutline: 'plotwise-envelope-outline',
  building: 'plotwise-building',
  area: 'plotwise-area',
  selectedEdge: 'plotwise-selected-edge',
  edge: 'plotwise-edge',
  road: 'plotwise-road',
  roadMarking: 'plotwise-road-marking',
  preview: 'plotwise-preview',
  midpoint: 'plotwise-midpoint',
  corner: 'plotwise-corner',
} as const

export type Palette = { plot: string; road: string; ink: string; paper: string }

const kind = (k: string): ExpressionSpecification => ['==', ['get', 'kind'], k]
const flag = (name: string): ExpressionSpecification => ['==', ['get', name], true]
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

const ENGLISH_LABEL: ExpressionSpecification = ['coalesce', ['get', 'name:en'], ['get', 'name:latin']]

export function labelInEnglish(map: MapLibreMap) {
  for (const layer of map.getStyle().layers) {
    if (layer.type !== 'symbol' || !JSON.stringify(layer.layout?.['text-field'] ?? '').includes('name')) continue
    map.setLayoutProperty(layer.id, 'text-field', ENGLISH_LABEL)
  }
}

export function readPalette(element: Element): Palette {
  const style = getComputedStyle(element)
  const read = (name: string) => style.getPropertyValue(`--color-${name}`).trim()
  return { plot: read('primary'), road: read('road'), ink: read('foreground'), paper: read('background') }
}

export function addEditorLayers(map: MapLibreMap, palette: Palette) {
  map.addSource(PLOT_SOURCE, { type: 'geojson', data: EMPTY })
  map.addSource(PREVIEW_SOURCE, { type: 'geojson', data: EMPTY })
  map.addSource(OVERLAY_SOURCE, { type: 'geojson', data: EMPTY_OVERLAY })
  const source = PLOT_SOURCE
  map.addLayer({
    id: LAYERS.area,
    type: 'fill',
    source,
    filter: kind('area'),
    paint: { 'fill-color': palette.plot, 'fill-opacity': 0.1 },
  })
  map.addLayer({
    id: LAYERS.envelope,
    type: 'fill',
    source: OVERLAY_SOURCE,
    filter: kind('envelope'),
    paint: { 'fill-color': palette.plot, 'fill-opacity': 0.14 },
  })
  map.addLayer({
    id: LAYERS.envelopeOutline,
    type: 'line',
    source: OVERLAY_SOURCE,
    filter: kind('envelope'),
    paint: { 'line-color': palette.plot, 'line-width': 1.5, 'line-dasharray': [3, 2] },
  })
  map.addLayer({
    id: LAYERS.building,
    type: 'fill',
    source: OVERLAY_SOURCE,
    filter: kind('building'),
    paint: { 'fill-color': palette.ink, 'fill-opacity': 0.22, 'fill-outline-color': palette.ink },
  })
  map.addLayer({
    id: LAYERS.selectedEdge,
    type: 'line',
    source,
    filter: ['all', kind('edge'), flag('selected')],
    layout: { 'line-cap': 'round' },
    paint: { 'line-color': palette.plot, 'line-width': 16, 'line-opacity': 0.18 },
  })
  map.addLayer({
    id: LAYERS.edge,
    type: 'line',
    source,
    filter: kind('edge'),
    layout: { 'line-cap': 'round' },
    paint: { 'line-color': palette.plot, 'line-width': 2.5 },
  })
  map.addLayer({
    id: LAYERS.road,
    type: 'line',
    source,
    filter: ['all', kind('edge'), flag('road')],
    paint: { 'line-color': palette.road, 'line-width': 9 },
  })
  map.addLayer({
    id: LAYERS.roadMarking,
    type: 'line',
    source,
    filter: ['all', kind('edge'), flag('road')],
    paint: { 'line-color': palette.paper, 'line-width': 1.5, 'line-dasharray': [3, 2.5] },
  })
  map.addLayer({
    id: LAYERS.preview,
    type: 'line',
    source: PREVIEW_SOURCE,
    paint: { 'line-color': palette.plot, 'line-width': 1.5, 'line-dasharray': [2, 2] },
  })
  map.addLayer({
    id: LAYERS.midpoint,
    type: 'circle',
    source,
    filter: kind('midpoint'),
    paint: {
      'circle-radius': 4,
      'circle-color': palette.paper,
      'circle-stroke-color': palette.plot,
      'circle-stroke-width': 1.5,
      'circle-opacity': 0.9,
    },
  })
  map.addLayer({
    id: LAYERS.corner,
    type: 'circle',
    source,
    filter: kind('corner'),
    paint: {
      'circle-radius': ['case', flag('closable'), 8, flag('selected'), 7.5, 5.5],
      'circle-color': ['case', ['any', flag('closable'), flag('selected')], palette.plot, palette.paper],
      'circle-stroke-color': ['case', flag('selected'), palette.paper, palette.plot],
      'circle-stroke-width': 2.5,
    },
  })
}
