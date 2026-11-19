import type { ExpressionSpecification, Map as MapLibreMap } from 'maplibre-gl'

export const PLOT_SOURCE = 'plotwise-plot'
export const PREVIEW_SOURCE = 'plotwise-preview'

export const LAYERS = {
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

export function readPalette(element: Element): Palette {
  const style = getComputedStyle(element)
  const read = (name: string) => style.getPropertyValue(`--color-${name}`).trim()
  return { plot: read('plot'), road: read('road'), ink: read('ink'), paper: read('paper') }
}

export function addEditorLayers(map: MapLibreMap, palette: Palette) {
  map.addSource(PLOT_SOURCE, { type: 'geojson', data: EMPTY })
  map.addSource(PREVIEW_SOURCE, { type: 'geojson', data: EMPTY })
  const source = PLOT_SOURCE
  map.addLayer({
    id: LAYERS.area,
    type: 'fill',
    source,
    filter: kind('area'),
    paint: { 'fill-color': palette.plot, 'fill-opacity': 0.1 },
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
